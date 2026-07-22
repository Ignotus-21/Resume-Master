import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { VerifyEmailBanner } from "@/components/VerifyEmailBanner";
import { ToastProvider } from "@/components/ui/Toast";
import { AuthProvider } from "@/lib/auth-context";
import QuotaModal from "@/components/QuotaModal";
import Footer from "@/components/Footer";
import { Analytics } from "@vercel/analytics/next";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Resume Master",
  description: "AI Powered Resume Builder and Job Tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased selection:bg-blue-100 flex min-h-screen flex-col`}>
        <ToastProvider>
          <AuthProvider>
            <Navbar />
            <VerifyEmailBanner />
            <main className="container mx-auto p-4 flex-1">
              {children}
            </main>
            <QuotaModal />
            <Footer />
          </AuthProvider>
        </ToastProvider>
        <Analytics />
      </body>
    </html>
  );
}
