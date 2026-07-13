'use client';

import { wordDiff } from '@/lib/wordDiff';

// Inline word-diff rendering: deletions struck through in red, additions on a
// green wash. Used wherever the user is deciding whether to take a text
// change — rewrite suggestions and the version compare view.

export function DiffText({ before, after }: { before: string; after: string }) {
  return (
    <>
      {wordDiff(before, after).map((seg, i) => {
        if (seg.op === 'del') {
          return (
            <del key={i} className="text-[#d93025]/70 decoration-[#d93025]/50">
              {seg.text}{' '}
            </del>
          );
        }
        if (seg.op === 'add') {
          return (
            <ins key={i} className="no-underline bg-green-100 text-[#188038] rounded-sm px-0.5">
              {seg.text}{' '}
            </ins>
          );
        }
        return <span key={i}>{seg.text} </span>;
      })}
    </>
  );
}
