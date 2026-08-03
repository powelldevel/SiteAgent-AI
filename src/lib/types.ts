export type Urgency = "low" | "medium" | "high";
export type JobStatus = "new" | "quoted" | "accepted" | "scheduled" | "in_progress" | "invoiced" | "paid";
export type QuoteStatus = "draft" | "sent" | "accepted" | "declined";
export type InvoiceStatus = "draft" | "sent" | "overdue" | "paid";
export type QuotePricingStatus = "matched" | "estimated" | "needs_review";

export type QuoteItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  pricingSource?: "company_price_list" | "ai_estimate" | "manual";
  confidence?: "high" | "medium" | "low";
  pricingStatus?: QuotePricingStatus;
};

export type PriceCategory = "material" | "labour" | "delivery" | "service" | "fee" | "other";

export type PriceItem = {
  id: string;
  name: string;
  category: PriceCategory;
  unit: string;
  unitPrice: number;
  vatRate: number;
  aliases: string[];
  notes: string | null;
  active: boolean;
};

export type ExtractedJob = {
  customerName: string;
  phone: string;
  location: string;
  jobType: string;
  title: string;
  materials: string[];
  estimatedDate: string;
  urgency: Urgency;
  missingDetails: string[];
  summary: string;
  quoteItems: QuoteItem[];
  followUpMessage: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
};

export type Worker = {
  id: string;
  name: string;
  phone: string;
  role: string;
  availabilityStatus: "available" | "booked" | "off";
};

export type Job = {
  id: string;
  customerId: string;
  title: string;
  description: string;
  location: string;
  status: JobStatus;
  urgency: Urgency;
  scheduledDate: string;
  assignedWorkerId?: string;
};

export type Quote = {
  id: string;
  jobId: string;
  quoteNumber: string;
  subtotal: number;
  tax: number;
  total: number;
  vatRegistered?: boolean;
  vatRate?: number;
  status: QuoteStatus;
  items: QuoteItem[];
};

export type Invoice = {
  id: string;
  jobId: string;
  invoiceNumber: string;
  total: number;
  status: InvoiceStatus;
  dueDate: string;
};
