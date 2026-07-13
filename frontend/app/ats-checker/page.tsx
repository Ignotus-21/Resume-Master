'use client';
import { Gauge } from 'lucide-react';
import { MatchPanel } from '@/components/resume/MatchPanel';

// Thin host for the shared MatchPanel — the same component the workspace's
// Match side panel renders. This page exists for the "no resume open yet"
// entry point (navbar, homepage card); all the logic lives in MatchPanel.

export default function AtsCheckerPage() {
  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#202124] flex items-center gap-2">
          <Gauge className="h-7 w-7 text-[#1a73e8]" /> ATS Checker
        </h1>
        <p className="text-[#5f6368]">Score your master profile against a job description and see what&apos;s missing.</p>
      </div>
      <MatchPanel />
    </div>
  );
}
