const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = path.resolve(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = [...walk('frontend/app'), ...walk('frontend/components')];

const replacements = [
  { rx: /\bfrom-purple-600\b/g, rep: 'from-[#1a73e8]' },
  { rx: /\bto-blue-600\b/g, rep: 'to-[#174ea6]' },
  { rx: /\btext-\[\#202124\] px-8 py-3\b/g, rep: 'text-white px-8 py-3' },
  { rx: /\bshadow-purple-900\/30\b/g, rep: 'shadow-blue-200/50' },
  { rx: /\bbg-red-900\/20\b/g, rep: 'bg-[#fce8e6]' },
  { rx: /\bbg-green-900\/20\b/g, rep: 'bg-green-50' },
  { rx: /\bbg-yellow-900\/20\b/g, rep: 'bg-yellow-50' },
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let originalContent = content;
  
  replacements.forEach(({rx, rep}) => {
    content = content.replace(rx, rep);
  });
  
  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log('Updated', file);
  }
});
