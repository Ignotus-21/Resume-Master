const mongoose = require('mongoose');

const apiUsageSchema = new mongoose.Schema({
  identity: { type: String, required: true, unique: true, index: true },
  count: { type: Number, default: 0 },
  windowStart: { type: Date, default: Date.now },
});

const ApiUsage = mongoose.model('ApiUsage', apiUsageSchema);
module.exports = ApiUsage;
