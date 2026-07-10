'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';

// Catches render/runtime errors from every route (there are no nested
// layouts, so this single boundary covers them all) and renders inside the
// root layout, keeping the navbar usable.
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#fce8e6] flex items-center justify-center">
        <AlertTriangle className="h-7 w-7 text-[#d93025]" />
      </div>
      <h1 className="text-xl font-bold text-[#202124]">Something went wrong</h1>
      <p className="text-sm text-[#5f6368] max-w-md">
        An unexpected error occurred. Your data is safe — try again, or head
        back to the dashboard.
      </p>
      <div className="flex gap-3 mt-2">
        <Button onClick={reset}>Try again</Button>
        <Link href="/dashboard">
          <Button variant="secondary">Go to dashboard</Button>
        </Link>
      </div>
    </div>
  );
}
