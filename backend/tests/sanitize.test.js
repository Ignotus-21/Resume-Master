const { stripOperators } = require('../middleware/sanitize');

describe('stripOperators', () => {
  it('removes top-level Mongo operator keys', () => {
    expect(stripOperators({ status: 'Applied', $where: 'sleep(10000)' })).toEqual({
      status: 'Applied',
    });
  });

  it('removes dotted-path keys used for NoSQL injection', () => {
    expect(stripOperators({ 'user.name': 'x', company: 'Acme' })).toEqual({
      company: 'Acme',
    });
  });

  it('recurses into nested objects and arrays', () => {
    const input = {
      job: { role: 'Eng', $ne: null },
      items: [{ $gt: '' }, { keep: 1 }],
    };
    expect(stripOperators(input)).toEqual({
      job: { role: 'Eng' },
      items: [{}, { keep: 1 }],
    });
  });

  it('leaves primitives and clean objects untouched', () => {
    expect(stripOperators('hello')).toBe('hello');
    expect(stripOperators(42)).toBe(42);
    expect(stripOperators({ a: 1, b: 'two' })).toEqual({ a: 1, b: 'two' });
  });
});
