create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  address text,
  logo_url text,
  created_at timestamptz not null default now()
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
  status text not null default 'draft',
  pdf_url text,
  created_at timestamptz not null default now(),
  constraint quotes_company_quote_number_unique unique (company_id, quote_number),
  constraint quotes_status_check check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired'))
);

create table quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references quotes(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null default 1,
  unit_price numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0
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

create index users_company_id_idx on users(company_id);
create index customers_company_created_idx on customers(company_id, created_at desc);
create index workers_company_status_idx on workers(company_id, availability_status);
create index jobs_company_created_idx on jobs(company_id, created_at desc);
create index jobs_company_status_idx on jobs(company_id, status);
create index quotes_company_created_idx on quotes(company_id, created_at desc);
create index quotes_job_id_idx on quotes(job_id);
create index quote_items_quote_id_idx on quote_items(quote_id);
create index invoices_company_created_idx on invoices(company_id, created_at desc);
create index invoices_job_id_idx on invoices(job_id);
create index messages_company_created_idx on messages(company_id, created_at desc);
create index messages_job_id_idx on messages(job_id);
create index payments_company_created_idx on payments(company_id, created_at desc);
create index ai_tasks_company_created_idx on ai_tasks(company_id, created_at desc);

alter table companies enable row level security;
alter table users enable row level security;
alter table customers enable row level security;
alter table workers enable row level security;
alter table jobs enable row level security;
alter table quotes enable row level security;
alter table quote_items enable row level security;
alter table invoices enable row level security;
alter table messages enable row level security;
alter table payments enable row level security;
alter table ai_tasks enable row level security;

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

create policy "company members manage invoices" on invoices
  for all using (company_id = current_company_id()) with check (company_id = current_company_id());

create policy "company members manage messages" on messages
  for all using (company_id = current_company_id()) with check (company_id = current_company_id());

create policy "company members manage payments" on payments
  for all using (company_id = current_company_id()) with check (company_id = current_company_id());

create policy "company members manage ai tasks" on ai_tasks
  for all using (company_id = current_company_id()) with check (company_id = current_company_id());
