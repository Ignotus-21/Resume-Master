jest.mock('../models/ApiUsage');
const ApiUsage = require('../models/ApiUsage');
const { consumeQuota } = require('../services/quotaService');

describe('quotaService.consumeQuota', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows and creates a fresh usage record for a new identity', async () => {
    ApiUsage.findOne.mockResolvedValue(null);
    ApiUsage.create.mockResolvedValue({ identity: 'user1', count: 1, windowStart: new Date() });

    const result = await consumeQuota('user1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(14);
    expect(ApiUsage.create).toHaveBeenCalledWith(expect.objectContaining({ identity: 'user1', count: 1 }));
  });

  it('increments and allows while under the limit', async () => {
    ApiUsage.findOne.mockResolvedValue({ identity: 'user1', count: 5, windowStart: new Date() });
    ApiUsage.findOneAndUpdate.mockResolvedValue({ identity: 'user1', count: 6 });

    const result = await consumeQuota('user1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it('rejects once the limit is reached within the window', async () => {
    ApiUsage.findOne.mockResolvedValue({ identity: 'user1', count: 15, windowStart: new Date() });

    const result = await consumeQuota('user1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(ApiUsage.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('resets the window once it has expired, even if previously at the limit', async () => {
    const oldWindowStart = new Date(Date.now() - 5 * 60 * 60 * 1000); // 5h ago > 4h window
    ApiUsage.findOne.mockResolvedValue({ identity: 'user1', count: 15, windowStart: oldWindowStart });
    ApiUsage.findOneAndUpdate.mockResolvedValue({ identity: 'user1', count: 1, windowStart: new Date() });

    const result = await consumeQuota('user1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(14);
  });
});
