const { getQuotaStatus } = require('../services/quotaService');
const { sendContactNotification } = require('../services/emailService');

// Keep in sync with SUBJECTS in frontend/components/ContactModal.tsx — the
// frontend <select> options must match this allow-list exactly, or a
// selection here gets rejected with a 400 (surfaced to the user as a toast).
const CONTACT_SUBJECTS = ['More tokens', 'General', 'Bug report'];
const MESSAGE_MAX_LENGTH = 5000;

const submitContact = async (req, res) => {
  const { subject, message } = req.body ?? {};
  if (!CONTACT_SUBJECTS.includes(subject)) {
    return res.status(400).json({ message: 'Subject must be one of: ' + CONTACT_SUBJECTS.join(', ') });
  }
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ message: 'Message is required' });
  }
  const trimmedMessage = message.trim();
  if (trimmedMessage.length > MESSAGE_MAX_LENGTH) {
    return res.status(400).json({ message: `Message must be ${MESSAGE_MAX_LENGTH} characters or fewer` });
  }

  try {
    const usage = await getQuotaStatus(req);
    await sendContactNotification({
      fromEmail: req.user.email,
      subject,
      message: trimmedMessage,
      usage,
    });
    res.json({ message: 'Message sent' });
  } catch (error) {
    console.error('Contact submission error:', error);
    res.status(500).json({ message: 'Failed to send message, please try again' });
  }
};

module.exports = { submitContact };
