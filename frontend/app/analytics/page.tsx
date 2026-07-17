import { redirect } from 'next/navigation';

// Analytics moved into Job Tracker (#35) — this route now just redirects
// so any existing bookmarks/links to /analytics keep working.
export default function AnalyticsRedirect() {
  redirect('/dashboard?view=analytics');
}
