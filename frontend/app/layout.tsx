import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { VerifyEmailBanner } from "@/components/VerifyEmailBanner";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthProvider } from "@/lib/auth-context";
import QuotaModal from "@/components/QuotaModal";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Liftoff Careers",
  description: "AI Powered Resume Builder and Job Tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased selection:bg-blue-100`}>
        <ToastProvider>
          <AuthProvider>
            <Navbar />
            <VerifyEmailBanner />
            <main className="container mx-auto p-4">
              {children}
            </main>
            <QuotaModal />
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
