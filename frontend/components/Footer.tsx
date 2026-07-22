'use client';

import { useState } from 'react';
import { ContactModal } from './ContactModal';

const FEEDBACK_FORM_URL = 'https://forms.gle/dU52fwyxKXmHC7wF6';

export default function Footer() {
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <>
      <footer className="border-t border-[#dadce0] mt-auto">
        <div className="container mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-[#5f6368]">
          <div>
            <span className="font-semibold text-[#202124]">Resume Master</span>
            <span className="mx-2">·</span>
            <span>Tailored resumes, built fast.</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href={FEEDBACK_FORM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#202124] transition"
            >
              Feedback
            </a>
            <button
              type="button"
              onClick={() => setContactOpen(true)}
              className="hover:text-[#202124] transition"
            >
              Contact us
            </button>
            <span>© {new Date().getFullYear()} Resume Master</span>
          </div>
        </div>
      </footer>
      <ContactModal open={contactOpen} onClose={() => setContactOpen(false)} />
    </>
  );
}
