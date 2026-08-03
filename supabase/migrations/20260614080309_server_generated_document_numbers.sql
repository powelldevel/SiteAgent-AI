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
  v_customer_id uuid;
  v_job_id uuid;
  v_quote_id uuid;
  v_invoice_id uuid;
  v_document_year integer;
  v_document_sequence integer;
  v_quote_number text;
  v_invoice_number text;
begin
  select users.company_id
  into v_company_id
  from public.users
  where users.id = auth.uid();

  if v_company_id is null then
    raise exception 'Create your company profile before saving jobs.'
      using errcode = '42501';
  end if;

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
    status
  )
  values (
    v_company_id,
    v_job_id,
    v_quote_number,
    p_subtotal,
    p_tax,
    p_total,
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
    (item ->> 'total')::numeric
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
    p_total,
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
      'quote', p_quote,
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
    'invoiceNumber', v_invoice_number
  );
end;
$$;

revoke execute on function public.save_operations_pack(
  text,
  text,
  jsonb,
  jsonb,
  numeric,
  numeric,
  numeric,
  date,
  date
) from public, anon;

grant execute on function public.save_operations_pack(
  text,
  text,
  jsonb,
  jsonb,
  numeric,
  numeric,
  numeric,
  date,
  date
) to authenticated;

create or replace function public.save_operations_pack(
  p_original_message text,
  p_extraction_mode text,
  p_job jsonb,
  p_quote jsonb,
  p_quote_number text,
  p_invoice_number text,
  p_subtotal numeric,
  p_tax numeric,
  p_total numeric,
  p_scheduled_date date,
  p_due_date date
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select public.save_operations_pack(
    p_original_message,
    p_extraction_mode,
    p_job,
    p_quote,
    p_subtotal,
    p_tax,
    p_total,
    p_scheduled_date,
    p_due_date
  );
$$;

revoke execute on function public.save_operations_pack(
  text,
  text,
  jsonb,
  jsonb,
  text,
  text,
  numeric,
  numeric,
  numeric,
  date,
  date
) from public, anon;

grant execute on function public.save_operations_pack(
  text,
  text,
  jsonb,
  jsonb,
  text,
  text,
  numeric,
  numeric,
  numeric,
  date,
  date
) to authenticated;
