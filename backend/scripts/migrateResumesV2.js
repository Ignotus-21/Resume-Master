// One-off backfill of pre-v2 resumes to the v2 shape:
//   content     <- tailoredData
//   mode        <- 'latex'  (the stored LaTeX was LLM-authored, not
//                  reproducible from content — treat it like an ejected doc)
//   latexSource <- latexCode
//   design      <- DEFAULT_DESIGN, templateId <- 'sheets'
// Rows it can't map (no latexCode at all) are logged and left untouched.
//
// Usage: MONGO_URI=... node scripts/migrateResumesV2.js [--dry-run]
// --dry-run logs every change it would make without writing anything.
require('dotenv').config();
const mongoose = require('mongoose');
const Resume = require('../models/Resume');
const { DEFAULT_DESIGN } = require('../shared/resume');

const dryRun = process.argv.includes('--dry-run');

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const legacy = await Resume.find({ mode: { $exists: false } });
  console.log(`${dryRun ? '[dry-run] ' : ''}Found ${legacy.length} pre-v2 resume(s)`);

  let migrated = 0;
  const skipped = [];
  for (const doc of legacy) {
    if (!doc.latexCode) {
      skipped.push(doc._id.toString());
      continue;
    }
    if (dryRun) {
      console.log(
        `[dry-run] would migrate ${doc._id}: mode=latex, latexSource<-latexCode (${doc.latexCode.length} chars), ` +
        `content<-tailoredData (${doc.tailoredData ? 'present' : 'absent'}), design<-DEFAULT_DESIGN, templateId=sheets`
      );
      migrated++;
      continue;
    }
    doc.mode = 'latex';
    doc.latexSource = doc.latexCode;
    doc.content = doc.tailoredData || undefined;
    doc.design = { ...DEFAULT_DESIGN };
    doc.templateId = 'sheets';
    await doc.save();
    migrated++;
  }

  console.log(`${dryRun ? '[dry-run] Would migrate' : 'Migrated'} ${migrated} resume(s)`);
  if (skipped.length) {
    console.log(`Skipped ${skipped.length} row(s) with no latexCode (unmappable):`);
    for (const id of skipped) console.log(`  - ${id}`);
  }
  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
