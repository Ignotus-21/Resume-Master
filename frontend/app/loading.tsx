import { PageSpinner } from '@/components/ui/Spinner';

// Route-transition fallback for every segment (no nested layouts, so one
// file covers all routes). In-page data-loading spinners stay where they
// are — they cover client-side fetches, which this can't.
export default function Loading() {
  return <PageSpinner />;
}
