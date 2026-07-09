const User = require('../models/User');

const adminAuth = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.isAdmin) {
      return res.status(403).json({ message: 'Forbidden: Admins only' });
    }
    
    // Attach the full user to the request for convenience
    req.user.isAdmin = true;
    next();
  } catch (err) {
    console.error("Admin Auth Error:", err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = adminAuth;
