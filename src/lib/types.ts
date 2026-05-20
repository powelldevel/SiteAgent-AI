export type Urgency = "low" | "medium" | "high";
export type JobStatus = "new" | "quoted" | "accepted" | "scheduled" | "in_progress" | "invoiced" | "paid";
export type QuoteStatus = "draft" | "sent" | "accepted" | "declined";
export type InvoiceStatus = "draft" | "sent" | "overdue" | "paid";

export type QuoteItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
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
