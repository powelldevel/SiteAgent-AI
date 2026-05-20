import type { Customer, Invoice, Job, Quote, Worker } from "./types";

export const company = {
  name: "Mokoena Build & Maintenance",
  phone: "+27 72 555 0198",
  email: "admin@mokoenabuild.co.za",
  address: "Modimolle, Limpopo",
};

export const customers: Customer[] = [
  {
    id: "cust-1",
    name: "Nomsa Dlamini",
    phone: "+27 82 441 9021",
    email: "nomsa@example.com",
    address: "Bela-Bela",
  },
  {
    id: "cust-2",
    name: "Pieter van Zyl",
    phone: "+27 83 220 7710",
    email: "pieter@example.com",
    address: "Mokopane",
  },
  {
    id: "cust-3",
    name: "Thabo Molefe",
    phone: "+27 79 112 4510",
    email: "thabo@example.com",
    address: "Polokwane",
  },
  {
    id: "cust-4",
    name: "Kagiso Mabuza",
    phone: "+27 74 618 3340",
    email: "kagiso@example.com",
    address: "Modimolle",
  },
];

export const workers: Worker[] = [
  {
    id: "worker-1",
    name: "Sipho Nkosi",
    phone: "+27 71 505 0101",
    role: "Builder",
    availabilityStatus: "available",
  },
  {
    id: "worker-2",
    name: "Ruan Jacobs",
    phone: "+27 76 333 2941",
    role: "Electrician",
    availabilityStatus: "booked",
  },
  {
    id: "worker-3",
    name: "Lerato Maseko",
    phone: "+27 78 900 2233",
    role: "Plumber",
    availabilityStatus: "available",
  },
  {
    id: "worker-4",
    name: "Mpho Baloyi",
    phone: "+27 72 418 8830",
    role: "Driver",
    availabilityStatus: "available",
  },
];

export const jobs: Job[] = [
  {
    id: "job-1",
    customerId: "cust-1",
    title: "Bathroom leak repair",
    description: "Repair leaking shower pipe, replace two tiles, reseal edge.",
    location: "Bela-Bela",
    status: "scheduled",
    urgency: "high",
    scheduledDate: "2026-05-21",
    assignedWorkerId: "worker-3",
  },
  {
    id: "job-2",
    customerId: "cust-2",
    title: "DB board inspection",
    description: "Inspect tripping DB board and quote for breaker replacement.",
    location: "Mokopane",
    status: "quoted",
    urgency: "medium",
    scheduledDate: "2026-05-24",
    assignedWorkerId: "worker-2",
  },
  {
    id: "job-3",
    customerId: "cust-3",
    title: "Boundary wall repair",
    description: "Rebuild damaged wall section and remove rubble.",
    location: "Polokwane",
    status: "accepted",
    urgency: "medium",
    scheduledDate: "2026-05-27",
    assignedWorkerId: "worker-1",
  },
  {
    id: "job-4",
    customerId: "cust-4",
    title: "Sand and stone delivery",
    description: "Deliver 6 cubes river sand and 2 cubes 19mm stone for slab preparation.",
    location: "Modimolle",
    status: "new",
    urgency: "high",
    scheduledDate: "2026-05-20",
    assignedWorkerId: "worker-4",
  },
];

export const quotes: Quote[] = [
  {
    id: "quote-1",
    jobId: "job-1",
    quoteNumber: "SG-Q-1001",
    subtotal: 3150,
    tax: 472.5,
    total: 3622.5,
    status: "accepted",
    items: [
      { description: "Plumbing labour", quantity: 1, unitPrice: 1400, total: 1400 },
      { description: "Tiles, sealant and fittings", quantity: 1, unitPrice: 950, total: 950 },
      { description: "Call-out and transport", quantity: 1, unitPrice: 800, total: 800 },
    ],
  },
  {
    id: "quote-2",
    jobId: "job-2",
    quoteNumber: "SG-Q-1002",
    subtotal: 1850,
    tax: 277.5,
    total: 2127.5,
    status: "sent",
    items: [
      { description: "Electrical inspection", quantity: 1, unitPrice: 950, total: 950 },
      { description: "Breaker allowance", quantity: 2, unitPrice: 250, total: 500 },
      { description: "Transport", quantity: 1, unitPrice: 400, total: 400 },
    ],
  },
  {
    id: "quote-3",
    jobId: "job-4",
    quoteNumber: "SG-Q-1003",
    subtotal: 7820,
    tax: 1173,
    total: 8993,
    status: "draft",
    items: [
      { description: "River sand, 6 cubes", quantity: 6, unitPrice: 650, total: 3900 },
      { description: "19mm stone, 2 cubes", quantity: 2, unitPrice: 760, total: 1520 },
      { description: "Tipper delivery and diesel", quantity: 1, unitPrice: 2400, total: 2400 },
    ],
  },
];

export const invoices: Invoice[] = [
  {
    id: "invoice-1",
    jobId: "job-1",
    invoiceNumber: "SG-I-2001",
    total: 3622.5,
    status: "sent",
    dueDate: "2026-05-28",
  },
];

export const sampleMessage =
  "Hi, it's Nomsa in Bela-Bela. The shower pipe is leaking badly and water is going into the passage. Can you send someone tomorrow morning? We may need two replacement tiles, sealant and fittings. Please quote me. My number is 082 441 9021.";

export const demoMessages = [
  {
    label: "Sand delivery",
    body: "Morning, Kagiso here from Modimolle. I need 6 cubes river sand and 2 cubes 19mm stone delivered to Extension 8 before Friday. The slab team starts Saturday, so please quote including transport. My number is 074 618 3340.",
  },
  {
    label: "Plumbing leak",
    body: sampleMessage,
  },
  {
    label: "Electrical fault",
    body: "Hi this is Pieter in Mokopane. Our DB board keeps tripping when the geyser runs. Can your electrician come tomorrow afternoon and quote for replacing the breaker if needed? Phone 083 220 7710.",
  },
  {
    label: "Renovation",
    body: "Thabo from Polokwane here. We want to renovate a small shop front: break out old counter, build a 3m drywall partition, paint, and repair cracked tiles. Please send a quote and tell me what photos you need. 079 112 4510.",
  },
];
