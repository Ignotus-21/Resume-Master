// Strips Mongo operator keys ($set, $where, ...) and dotted paths from
// user-supplied request bodies before they ever reach Mongoose, closing off
// NoSQL query-injection via crafted JSON bodies (e.g. { "$gt": "" }).
const stripOperators = (value) => {
  if (Array.isArray(value)) {
    return value.map(stripOperators);
  }
  if (value && typeof value === 'object') {
    const clean = {};
    for (const [key, val] of Object.entries(value)) {
      if (key.startsWith('$') || key.includes('.')) continue;
      clean[key] = stripOperators(val);
    }
    return clean;
  }
  return value;
};

const sanitizeBody = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = stripOperators(req.body);
  }
  // Query strings can also carry Mongo operators (e.g. ?jobId[$ne]=x). In
  // Express 5 req.query is a re-parsing getter that can't be mutated in place,
  // so redefine it with a sanitized snapshot.
  if (req.query && typeof req.query === 'object') {
    const cleanQuery = stripOperators({ ...req.query });
    Object.defineProperty(req, 'query', {
      value: cleanQuery,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }
  next();
};

module.exports = { sanitizeBody, stripOperators };
