import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SiteGent | AI operations for contractors",
  description:
    "WhatsApp-first AI operations manager for South African contractors and field-service businesses.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
