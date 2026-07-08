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
  next();
};

module.exports = { sanitizeBody, stripOperators };
