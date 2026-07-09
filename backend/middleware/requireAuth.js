const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Sign in required' });
  }
  next();
};

module.exports = requireAuth;
