alter table public.companies
  add column if not exists vat_registered boolean not null default false,
  add column if not exists vat_rate numeric(5,4) not null default 0.15;

alter table public.companies
  drop constraint if exists companies_vat_rate_check;

alter table public.companies
  add constraint companies_vat_rate_check
  check (vat_rate >= 0 and vat_rate <= 1);

alter table public.quotes
  add column if not exists vat_registered boolean not null default false,
  add column if not exists vat_rate numeric(5,4) not null default 0;

alter table public.quotes
  drop constraint if exists quotes_vat_rate_check;

alter table public.quotes
  add constraint quotes_vat_rate_check
  check (vat_rate >= 0 and vat_rate <= 1);

update public.quotes
set
  vat_registered = tax > 0,
  vat_rate = case
    when subtotal > 0 and tax > 0 then least(1, round(tax / subtotal, 4))
    else 0
  end;

drop policy if exists "company members update own company" on public.companies;

create policy "company members update own company" on public.companies
  for update
  using (id = public.current_company_id())
  with check (id = public.current_company_id());

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
  select
    users.company_id,
    companies.vat_registered,
    companies.vat_rate
  into
    v_company_id,
    v_vat_registered,
    v_vat_rate
  from public.users
  join public.companies on companies.id = users.company_id
  where users.id = auth.uid();

  if v_company_id is null then
    raise exception 'Create your company profile before saving jobs.'
      using errcode = '42501';
  end if;

  select coalesce(
    round(sum(
      (item ->> 'quantity')::numeric * (item ->> 'unitPrice')::numeric
    ), 2),
    0
  )
  into v_subtotal
  from jsonb_array_elements(p_quote -> 'items') as item;

  v_tax := case
    when v_vat_registered then round(v_subtotal * v_vat_rate, 2)
    else 0
  end;
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
  values (
    v_company_id,
    p_job ->> 'customerName',
    p_job ->> 'phone',
    p_job ->> 'location'
  )
  returning id into v_customer_id;

  insert into public.jobs (
    company_id,
    customer_id,
    title,
    description,
    location,
    status,
    urgency,
    scheduled_date
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
    company_id,
    customer_id,
    job_id,
    channel,
    direction,
    body,
    ai_summary
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
    company_id,
    job_id,
    quote_number,
    subtotal,
    tax,
    total,
    vat_registered,
    vat_rate,
    status
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

  insert into public.quote_items (
    quote_id,
    description,
    quantity,
    unit_price,
    total
  )
  select
    v_quote_id,
    item ->> 'description',
    (item ->> 'quantity')::numeric,
    (item ->> 'unitPrice')::numeric,
    round((item ->> 'quantity')::numeric * (item ->> 'unitPrice')::numeric, 2)
  from jsonb_array_elements(p_quote -> 'items') as item;

  insert into public.invoices (
    company_id,
    job_id,
    invoice_number,
    total,
    status,
    due_date
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
    company_id,
    job_id,
    task_type,
    input,
    output,
    status
  )
  values (
    v_company_id,
    v_job_id,
    'job_intake_operations_pack',
    jsonb_build_object(
      'message', p_original_message,
      'extractionMode', p_extraction_mode
    ),
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
