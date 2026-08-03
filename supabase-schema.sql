create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  logo_url text,
  vat_registered boolean not null default false,
  vat_rate numeric(5,4) not null default 0.15,
  created_at timestamptz not null default now(),
  constraint companies_vat_rate_check check (vat_rate >= 0 and vat_rate <= 1)
);

create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null default 'owner',
  company_id uuid not null references companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint users_role_check check (role in ('owner', 'admin', 'worker'))
);

create table customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  address text,
  created_at timestamptz not null default now()
);

create table workers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  phone text,
  role text,
  availability_status text not null default 'available',
  created_at timestamptz not null default now(),
  constraint workers_availability_status_check check (availability_status in ('available', 'busy', 'offline'))
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  title text not null,
  description text,
  location text,
  status text not null default 'new',
  urgency text not null default 'medium',
  scheduled_date date,
  assigned_worker_id uuid references workers(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint jobs_status_check check (status in ('new', 'quoted', 'accepted', 'scheduled', 'completed', 'cancelled')),
  constraint jobs_urgency_check check (urgency in ('low', 'medium', 'high'))
);

create table quotes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  quote_number text not null,
  subtotal numeric(12,2) not null default 0,
  tax numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  vat_registered boolean not null default false,
  vat_rate numeric(5,4) not null default 0,
  status text not null default 'draft',
  pdf_url text,
  created_at timestamptz not null default now(),
  constraint quotes_company_quote_number_unique unique (company_id, quote_number),
  constraint quotes_status_check check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  constraint quotes_vat_rate_check check (vat_rate >= 0 and vat_rate <= 1)
);

create table quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0
);

create table if not exists price_items (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  category text not null default 'material',
  unit text not null default 'each',
  unit_price numeric(12,2) not null default 0,
  vat_rate numeric(5,4) not null default 0.15,
  aliases text[] not null default '{}',
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint price_items_category_check check (category in ('material', 'labour', 'delivery', 'service', 'fee', 'other')),
  constraint price_items_unit_price_check check (unit_price >= 0),
  constraint price_items_vat_rate_check check (vat_rate >= 0 and vat_rate <= 1)
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  job_id uuid not null references jobs(id) on delete cascade,
  invoice_number text not null,
  total numeric(12,2) not null default 0,
  status text not null default 'draft',
  due_date date,
  pdf_url text,
  created_at timestamptz not null default now(),
  constraint invoices_company_invoice_number_unique unique (company_id, invoice_number),
  constraint invoices_status_check check (status in ('draft', 'sent', 'paid', 'overdue', 'cancelled'))
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  customer_id uuid references customers(id) on delete set null,
  job_id uuid references jobs(id) on delete set null,
  channel text not null default 'whatsapp',
  direction text not null default 'inbound',
  body text not null,
  ai_summary text,
  created_at timestamptz not null default now(),
  constraint messages_direction_check check (direction in ('inbound', 'outbound')),
  constraint messages_channel_check check (channel in ('whatsapp', 'sms', 'email', 'web', 'phone'))
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  status text not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  constraint payments_status_check check (status in ('pending', 'paid', 'failed', 'refunded'))
);

create table ai_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  task_type text not null,
  input jsonb not null,
  output jsonb,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  constraint ai_tasks_status_check check (status in ('queued', 'running', 'completed', 'failed'))
);

create table if not exists ai_extraction_usage (
  id bigint generated always as identity primary key,
  company_id uuid not null references companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists observability_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  company_id uuid references companies(id) on delete cascade,
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

create index users_company_id_idx on users(company_id);
create index customers_company_created_idx on customers(company_id, created_at desc);
create index workers_company_status_idx on workers(company_id, availability_status);
create index jobs_company_created_idx on jobs(company_id, created_at desc);
create index jobs_company_status_idx on jobs(company_id, status);
create index quotes_company_created_idx on quotes(company_id, created_at desc);
create index quotes_job_id_idx on quotes(job_id);
create index quote_items_quote_id_idx on quote_items(quote_id);
create index if not exists price_items_company_active_idx on price_items(company_id, active, name);
create index invoices_company_created_idx on invoices(company_id, created_at desc);
create index invoices_job_id_idx on invoices(job_id);
create index messages_company_created_idx on messages(company_id, created_at desc);
create index messages_job_id_idx on messages(job_id);
create index payments_company_created_idx on payments(company_id, created_at desc);
create index ai_tasks_company_created_idx on ai_tasks(company_id, created_at desc);
create index if not exists ai_extraction_usage_company_created_idx
  on ai_extraction_usage(company_id, created_at desc);
create index if not exists ai_extraction_usage_user_created_idx
  on ai_extraction_usage(user_id, created_at desc);
create index if not exists observability_events_company_created_idx
  on observability_events(company_id, created_at desc);
create index if not exists observability_events_action_created_idx
  on observability_events(action, created_at desc);

alter table companies enable row level security;
alter table users enable row level security;
alter table customers enable row level security;
alter table workers enable row level security;
alter table jobs enable row level security;
alter table quotes enable row level security;
alter table quote_items enable row level security;
alter table price_items enable row level security;
alter table invoices enable row level security;
alter table messages enable row level security;
alter table payments enable row level security;
alter table ai_tasks enable row level security;
alter table ai_extraction_usage enable row level security;
alter table observability_events enable row level security;

revoke all on table ai_extraction_usage from public, anon, authenticated;
grant select, insert, delete on table ai_extraction_usage to service_role;
grant usage, select on sequence ai_extraction_usage_id_seq to service_role;

revoke all on table observability_events from public, anon, authenticated;
revoke all on sequence observability_events_id_seq from public, anon, authenticated;
grant select, insert, delete on table observability_events to service_role;
grant usage, select on sequence observability_events_id_seq to service_role;

create or replace function current_company_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from users where id = auth.uid()
$$;

create policy "company members read own company" on companies
  for select using (id = current_company_id());

create policy "company members update own company" on companies
  for update using (id = current_company_id()) with check (id = current_company_id());

create policy "users read own profile" on users
  for select using (id = auth.uid());

create policy "users update own profile" on users
  for update using (id = auth.uid()) with check (id = auth.uid() and company_id = current_company_id());

create policy "company members manage customers" on customers
  for all using (company_id = current_company_id()) with check (company_id = current_company_id());

create policy "company members manage workers" on workers
  for all using (company_id = current_company_id()) with check (company_id = current_company_id());

create policy "company members manage jobs" on jobs
  for all using (company_id = current_company_id()) with check (company_id = current_company_id());

create policy "company members manage quotes" on quotes
  for all using (company_id = current_company_id()) with check (company_id = current_company_id());

create policy "company members manage quote items" on quote_items
  for all using (
    exists (
      select 1 from quotes
      where quotes.id = quote_items.quote_id
      and quotes.company_id = current_company_id()
    )
  ) with check (
    exists (
      select 1 from quotes
      where quotes.id = quote_items.quote_id
      and quotes.company_id = current_company_id()
    )
  );

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
    and tablename = 'price_items'
    and policyname = 'company members manage price items'
  ) then
    create policy "company members manage price items" on price_items
      for all using (company_id = current_company_id()) with check (company_id = current_company_id());
  end if;
end $$;

create policy "company members manage invoices" on invoices
  for all using (company_id = current_company_id()) with check (company_id = current_company_id());

create policy "company members manage messages" on messages
  for all using (company_id = current_company_id()) with check (company_id = current_company_id());

create policy "company members manage payments" on payments
  for all using (company_id = current_company_id()) with check (company_id = current_company_id());

create policy "company members manage ai tasks" on ai_tasks
  for all using (company_id = current_company_id()) with check (company_id = current_company_id());

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

drop function if exists public.save_operations_pack(
  text, text, jsonb, jsonb, text, text, numeric, numeric, numeric, date, date
);

create or replace function public.save_operations_pack(
  p_original_message text,
  p_extraction_mode text,
  p_job jsonb,
  p_quote jsonb,
  p_subtotal numeric,
  p_tax numeric,
  p_total numeric,
  p_scheduled_date date,
  p_due_date date
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_company_id uuid;
  v_vat_registered boolean;
  v_vat_rate numeric(5,4);
  v_subtotal numeric(12,2);
  v_tax numeric(12,2);
  v_total numeric(12,2);
  v_customer_id uuid;
  v_job_id uuid;
  v_quote_id uuid;
  v_invoice_id uuid;
  v_document_year integer;
  v_document_sequence integer;
  v_quote_number text;
  v_invoice_number text;
begin
  select users.company_id, companies.vat_registered, companies.vat_rate
  into v_company_id, v_vat_registered, v_vat_rate
  from public.users
  join public.companies on companies.id = users.company_id
  where users.id = auth.uid();

  if v_company_id is null then
    raise exception 'Create your company profile before saving jobs.'
      using errcode = '42501';
  end if;

  select coalesce(
    round(sum((item ->> 'quantity')::numeric * (item ->> 'unitPrice')::numeric), 2),
    0
  )
  into v_subtotal
  from jsonb_array_elements(p_quote -> 'items') as item;

  v_tax := case when v_vat_registered then round(v_subtotal * v_vat_rate, 2) else 0 end;
  v_total := round(v_subtotal + v_tax, 2);

  v_document_year := extract(year from current_date)::integer;

  perform pg_advisory_xact_lock(
    hashtextextended(v_company_id::text || ':' || v_document_year::text, 0)
  );

  select coalesce(max(right(quotes.quote_number, 6)::integer), 0) + 1
  into v_document_sequence
  from public.quotes
  where quotes.company_id = v_company_id
    and quotes.quote_number ~ ('^SG-Q-' || v_document_year::text || '-[0-9]{6}$');

  if v_document_sequence > 999999 then
    raise exception 'The annual document number limit has been reached.'
      using errcode = '22003';
  end if;

  v_quote_number := format(
    'SG-Q-%s-%s',
    v_document_year,
    lpad(v_document_sequence::text, 6, '0')
  );
  v_invoice_number := format(
    'SG-I-%s-%s',
    v_document_year,
    lpad(v_document_sequence::text, 6, '0')
  );

  insert into public.customers (company_id, name, phone, address)
  values (v_company_id, p_job ->> 'customerName', p_job ->> 'phone', p_job ->> 'location')
  returning id into v_customer_id;

  insert into public.jobs (
    company_id, customer_id, title, description, location, status, urgency, scheduled_date
  )
  values (
    v_company_id,
    v_customer_id,
    p_job ->> 'title',
    p_job ->> 'summary',
    p_job ->> 'location',
    'quoted',
    p_job ->> 'urgency',
    p_scheduled_date
  )
  returning id into v_job_id;

  insert into public.messages (
    company_id, customer_id, job_id, channel, direction, body, ai_summary
  )
  values (
    v_company_id,
    v_customer_id,
    v_job_id,
    'whatsapp',
    'inbound',
    p_original_message,
    p_job ->> 'summary'
  );

  insert into public.quotes (
    company_id, job_id, quote_number, subtotal, tax, total, vat_registered, vat_rate, status
  )
  values (
    v_company_id,
    v_job_id,
    v_quote_number,
    v_subtotal,
    v_tax,
    v_total,
    v_vat_registered,
    case when v_vat_registered then v_vat_rate else 0 end,
    'draft'
  )
  returning id into v_quote_id;

  insert into public.quote_items (quote_id, description, quantity, unit_price, total)
  select
    v_quote_id,
    item ->> 'description',
    (item ->> 'quantity')::numeric,
    (item ->> 'unitPrice')::numeric,
    round((item ->> 'quantity')::numeric * (item ->> 'unitPrice')::numeric, 2)
  from jsonb_array_elements(p_quote -> 'items') as item;

  insert into public.invoices (
    company_id, job_id, invoice_number, total, status, due_date
  )
  values (
    v_company_id,
    v_job_id,
    v_invoice_number,
    v_total,
    'draft',
    p_due_date
  )
  returning id into v_invoice_id;

  insert into public.ai_tasks (
    company_id, job_id, task_type, input, output, status
  )
  values (
    v_company_id,
    v_job_id,
    'job_intake_operations_pack',
    jsonb_build_object('message', p_original_message, 'extractionMode', p_extraction_mode),
    jsonb_build_object(
      'extractedJob', p_job,
      'quote', p_quote || jsonb_build_object(
        'subtotal', v_subtotal,
        'tax', v_tax,
        'total', v_total,
        'vatRegistered', v_vat_registered,
        'vatRate', case when v_vat_registered then v_vat_rate else 0 end
      ),
      'followUpMessage', p_job ->> 'followUpMessage'
    ),
    'completed'
  );

  return jsonb_build_object(
    'customerId', v_customer_id,
    'jobId', v_job_id,
    'quoteId', v_quote_id,
    'invoiceId', v_invoice_id,
    'quoteNumber', v_quote_number,
    'invoiceNumber', v_invoice_number,
    'subtotal', v_subtotal,
    'tax', v_tax,
    'total', v_total,
    'vatRegistered', v_vat_registered,
    'vatRate', case when v_vat_registered then v_vat_rate else 0 end
  );
end;
$$;

revoke execute on function public.save_operations_pack(
  text, text, jsonb, jsonb, numeric, numeric, numeric, date, date
) from public, anon;

grant execute on function public.save_operations_pack(
  text, text, jsonb, jsonb, numeric, numeric, numeric, date, date
) to authenticated;
