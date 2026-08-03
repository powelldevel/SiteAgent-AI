create table if not exists public.observability_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  company_id uuid references public.companies(id) on delete cascade,
  route text not null,
  action text not null,
  status text not null,
  level text not null default 'error',
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint observability_events_status_check
    check (status in ('success', 'failed', 'blocked', 'fallback')),
  constraint observability_events_level_check
    check (level in ('info', 'warning', 'error'))
);

create index if not exists observability_events_company_created_idx
  on public.observability_events(company_id, created_at desc);

create index if not exists observability_events_action_created_idx
  on public.observability_events(action, created_at desc);

alter table public.observability_events enable row level security;

revoke all on table public.observability_events from public, anon, authenticated;
revoke all on sequence public.observability_events_id_seq from public, anon, authenticated;

grant select, insert, delete on table public.observability_events to service_role;
grant usage, select on sequence public.observability_events_id_seq to service_role;
