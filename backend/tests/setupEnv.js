process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-gemini-key';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'a'.repeat(64);
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// identify() fires an unawaited ActiveSession.updateOne() on every request
// to track "live users". With no real DB connection in tests, an unmocked
// call buffers for 10s before rejecting, leaking past test teardown and
// making Jest hang / log after the run completes. Mock it so it resolves
// immediately, same as every other model tests already mock explicitly.
jest.mock('../models/ActiveSession', () => ({
  updateOne: jest.fn().mockResolvedValue({}),
}));
