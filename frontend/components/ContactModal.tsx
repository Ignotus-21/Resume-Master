'use client';

import { useState } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { useToast } from './ui/Toast';
import { apiJson, ApiError } from '@/lib/api';

const SUBJECTS = ['More tokens', 'General', 'Bug report'] as const;

export function ContactModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [subject, setSubject] = useState<(typeof SUBJECTS)[number]>('General');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      showToast('Message is required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await apiJson('/api/support/contact', 'POST', { subject, message: message.trim() });
      showToast("Message sent — we'll get back to you soon", 'success');
      setMessage('');
      onClose();
    } catch (error) {
      const msg = error instanceof ApiError ? error.message : 'Failed to send message';
      showToast(msg, 'error');
    }
    setSubmitting(false);
  };

  return (
    <Modal open={open} onClose={onClose} title="Contact us">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="contact-subject" className="block text-sm font-medium text-[#202124] mb-1.5">
            Subject
          </label>
          <select
            id="contact-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value as (typeof SUBJECTS)[number])}
            className="w-full rounded-xl border border-[#dadce0] px-3 py-2.5 text-sm text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#1a73e8]"
          >
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="contact-message" className="block text-sm font-medium text-[#202124] mb-1.5">
            Message
          </label>
          <textarea
            id="contact-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            maxLength={5000}
            required
            placeholder="How can we help?"
            className="w-full rounded-xl border border-[#dadce0] px-3 py-2.5 text-sm text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#1a73e8] resize-none"
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Send
          </Button>
        </div>
      </form>
    </Modal>
  );
}
