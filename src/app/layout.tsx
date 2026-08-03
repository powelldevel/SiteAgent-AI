import type { Metadata } from "next";
import { ClientErrorReporter } from "@/components/client-error-reporter";
import "./globals.css";

const siteUrl = "https://sitegent.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SiteGent | WhatsApp quote assistant for contractors",
    template: "%s | SiteGent",
  },
  description:
    "Turn WhatsApp job messages into quote drafts, job cards, replies, and invoices using your own contractor price list.",
  applicationName: "SiteGent",
  keywords: [
    "contractor quote app",
    "WhatsApp quote assistant",
    "South African contractors",
    "AI invoice app",
    "job card app",
    "construction quote software",
  ],
  authors: [{ name: "SiteGent" }],
  creator: "SiteGent",
  publisher: "SiteGent",
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: "SiteGent | WhatsApp quote assistant for contractors",
    description:
      "Paste the customer message, get a quote draft using your prices, then save the job and export the invoice.",
    url: siteUrl,
    siteName: "SiteGent",
    locale: "en_ZA",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "SiteGent | WhatsApp quote assistant for contractors",
    description:
      "Paste the customer message, get a quote draft using your prices, then save the job and export the invoice.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "SiteGent",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: siteUrl,
  description:
    "A WhatsApp-first quote assistant that helps South African contractors turn customer job messages into quotes, job cards, replies, and invoices.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "ZAR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <ClientErrorReporter />
      </body>
    </html>
  );
}
