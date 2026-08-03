create table if not exists public.ai_extraction_usage (
  id bigint generated always as identity primary key,
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists ai_extraction_usage_company_created_idx
  on public.ai_extraction_usage(company_id, created_at desc);

create index if not exists ai_extraction_usage_user_created_idx
  on public.ai_extraction_usage(user_id, created_at desc);

alter table public.ai_extraction_usage enable row level security;

revoke all on table public.ai_extraction_usage from public, anon, authenticated;
grant select, insert, delete on table public.ai_extraction_usage to service_role;
grant usage, select on sequence public.ai_extraction_usage_id_seq to service_role;

create or replace function public.consume_ai_extraction_quota(
  p_user_id uuid,
  p_company_id uuid,
  p_user_limit integer default 20,
  p_company_limit integer default 100,
  p_window_seconds integer default 3600
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_user_count integer;
  v_company_count integer;
  v_oldest timestamptz;
  v_retry_after integer;
begin
  if p_user_limit < 1 or p_user_limit > 10000
    or p_company_limit < 1 or p_company_limit > 100000
    or p_window_seconds < 60 or p_window_seconds > 86400 then
    raise exception 'Invalid AI extraction quota configuration.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.users
    where users.id = p_user_id
      and users.company_id = p_company_id
  ) then
    raise exception 'The user does not belong to this company.'
      using errcode = '42501';
  end if;

  v_window_start := v_now - make_interval(secs => p_window_seconds);

  perform pg_advisory_xact_lock(
    hashtextextended('ai-company:' || p_company_id::text, 0)
  );
  perform pg_advisory_xact_lock(
    hashtextextended('ai-user:' || p_user_id::text, 0)
  );

  select count(*)::integer, min(created_at)
  into v_company_count, v_oldest
  from public.ai_extraction_usage
  where company_id = p_company_id
    and created_at > v_window_start;

  if v_company_count >= p_company_limit then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from ((v_oldest + make_interval(secs => p_window_seconds)) - v_now)))::integer
    );

    return jsonb_build_object(
      'allowed', false,
      'scope', 'company',
      'limit', p_company_limit,
      'remaining', 0,
      'retryAfter', v_retry_after
    );
  end if;

  select count(*)::integer, min(created_at)
  into v_user_count, v_oldest
  from public.ai_extraction_usage
  where user_id = p_user_id
    and created_at > v_window_start;

  if v_user_count >= p_user_limit then
    v_retry_after := greatest(
      1,
      ceil(extract(epoch from ((v_oldest + make_interval(secs => p_window_seconds)) - v_now)))::integer
    );

    return jsonb_build_object(
      'allowed', false,
      'scope', 'user',
      'limit', p_user_limit,
      'remaining', 0,
      'retryAfter', v_retry_after
    );
  end if;

  insert into public.ai_extraction_usage (company_id, user_id, created_at)
  values (p_company_id, p_user_id, v_now);

  return jsonb_build_object(
    'allowed', true,
    'scope', null,
    'limit', p_user_limit,
    'remaining', greatest(p_user_limit - v_user_count - 1, 0),
    'retryAfter', 0
  );
end;
$$;

revoke execute on function public.consume_ai_extraction_quota(
  uuid, uuid, integer, integer, integer
) from public, anon, authenticated;

grant execute on function public.consume_ai_extraction_quota(
  uuid, uuid, integer, integer, integer
) to service_role;
