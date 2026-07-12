// Re-export: the fixture lives in shared/fixtureProfile.js so
// scripts/warmTectonicCache.js can use it inside the Docker image, where
// tests/ is excluded (see backend/.dockerignore). Tests keep importing it
// from here.
module.exports = require('../../shared/fixtureProfile');
