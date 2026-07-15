'use client';
import Link from 'next/link';
import { Bot } from 'lucide-react';
import { Card } from '@/components/ui/Card';

// The general-purpose chatbot is disabled while it lacks guardrails (no
// system instruction, topic scoping, or output moderation — see
// backend/routes/aiRoutes.js). This page is kept as a soft landing for old
// bookmarks; no navigation links to it anymore.
export default function ChatPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      <Card className="w-full max-w-md p-10 text-center">
        <Bot className="h-12 w-12 mx-auto mb-4 text-[#5f6368]" />
        <h1 className="text-2xl font-bold text-[#202124] mb-2">AI Chat is temporarily unavailable</h1>
        <p className="text-[#5f6368] mb-6">
          We&apos;ve taken the chat assistant offline while we rework it. In the meantime, the
          resume, cover letter, and interview tools are all still available.
        </p>
        <Link href="/dashboard" className="text-[#1a73e8] hover:underline font-medium">
          Back to your dashboard
        </Link>
      </Card>
    </div>
  );
}
