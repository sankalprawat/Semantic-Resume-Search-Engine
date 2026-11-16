import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Multi-Candidate Semantic Talent Engine",
  description: "Enterprise Semantic Search & Grounded Comparative Candidate Evaluation",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-surface-50 text-ink-primary font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
