const { encrypt, decrypt } = require('../utils/crypto');

describe('crypto encrypt/decrypt', () => {
  it('round-trips plaintext', () => {
    const plaintext = 'AIzaSy-fake-gemini-key-1234567890';
    const encrypted = encrypt(plaintext);
    expect(encrypted).not.toEqual(plaintext);
    expect(decrypt(encrypted)).toBe(plaintext);
  });

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const a = encrypt('same-value');
    const b = encrypt('same-value');
    expect(a).not.toEqual(b);
  });

  it('fails to decrypt tampered ciphertext', () => {
    const encrypted = encrypt('secret-key');
    const tampered = Buffer.from(encrypted, 'base64');
    tampered[tampered.length - 1] ^= 0xff;
    expect(() => decrypt(tampered.toString('base64'))).toThrow();
  });
});
