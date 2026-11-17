import type { Metadata } from "next";
import { ThemeProvider } from "@/context/ThemeContext";
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
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-surface-50 dark:bg-[#121110] text-ink-primary dark:text-[#F5F4F0] font-sans antialiased selection:bg-yellow-300 selection:text-stone-900 transition-colors duration-200">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
