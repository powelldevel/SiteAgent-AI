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
  email text not null,
  role text not null default 'owner',
  company_id uuid not null references companies(id) on delete cascade,
  created_at timestamptz not null default now()
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
  created_at timestamptz not null default now()
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
  created_at timestamptz not null default now()
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
  created_at timestamptz not null default now()
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
  created_at timestamptz not null default now()
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
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,
  amount numeric(12,2) not null default 0,
  status text not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table ai_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  job_id uuid references jobs(id) on delete set null,
  task_type text not null,
  input jsonb not null,
  output jsonb,
  status text not null default 'queued',
  created_at timestamptz not null default now()
);

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
as $$
  select company_id from users where id = auth.uid()
$$;

create policy "company members read own company" on companies
  for select using (id = current_company_id());

create policy "company members manage customers" on customers
  for all using (company_id = current_company_id()) with check (company_id = current_company_id());

create policy "company members manage workers" on workers
  for all using (company_id = current_company_id()) with check (company_id = current_company_id());

create policy "company members manage jobs" on jobs
  for all using (company_id = current_company_id()) with check (company_id = current_company_id());

create policy "company members manage quotes" on quotes
  for all using (company_id = current_company_id()) with check (company_id = current_company_id());

create policy "company members manage invoices" on invoices
  for all using (company_id = current_company_id()) with check (company_id = current_company_id());

create policy "company members manage messages" on messages
  for all using (company_id = current_company_id()) with check (company_id = current_company_id());

create policy "company members manage payments" on payments
  for all using (company_id = current_company_id()) with check (company_id = current_company_id());

create policy "company members manage ai tasks" on ai_tasks
  for all using (company_id = current_company_id()) with check (company_id = current_company_id());
