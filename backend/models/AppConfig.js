const mongoose = require('mongoose');

const appConfigSchema = new mongoose.Schema({
  key: { type: String, default: 'global', unique: true },
  defaultTokenLimit: { type: Number, default: 15000 },
}, {
  timestamps: true,
});

const AppConfig = mongoose.model('AppConfig', appConfigSchema);
module.exports = AppConfig;
