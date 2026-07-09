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
  { rx: /\btext-white\b/g, rep: 'text-[#202124]' },
  { rx: /\btext-zinc-400\b/g, rep: 'text-[#5f6368]' },
  { rx: /\btext-slate-400\b/g, rep: 'text-[#5f6368]' },
  { rx: /\btext-slate-500\b/g, rep: 'text-[#5f6368]' },
  { rx: /\btext-slate-200\b/g, rep: 'text-[#202124]' },
  { rx: /\btext-zinc-500\b/g, rep: 'text-[#5f6368]' },
  { rx: /\bbg-black\/40\b/g, rep: 'bg-[#f8f9fa]' },
  { rx: /\bbg-black\/60\b/g, rep: 'bg-white' },
  { rx: /\bbg-slate-900\b/g, rep: 'bg-[#f8f9fa]' },
  { rx: /\bbg-slate-800\/40\b/g, rep: 'bg-[#f8f9fa]' },
  { rx: /\bbg-slate-800\/30\b/g, rep: 'bg-[#f8f9fa]' },
  { rx: /\bbg-slate-800\b/g, rep: 'bg-[#f8f9fa]' },
  { rx: /\bbg-zinc-900\/90\b/g, rep: 'bg-white' },
  { rx: /\bbg-zinc-900\/60\b/g, rep: 'bg-white' },
  { rx: /\bbg-zinc-900\/40\b/g, rep: 'bg-white' },
  { rx: /\bborder-white\/10\b/g, rep: 'border-[#dadce0]' },
  { rx: /\bborder-white\/5\b/g, rep: 'border-[#dadce0]' },
  { rx: /\bborder-slate-700\b/g, rep: 'border-[#dadce0]' },
  { rx: /\bborder-slate-800\b/g, rep: 'border-[#dadce0]' },
  { rx: /\btext-purple-400\b/g, rep: 'text-[#1a73e8]' },
  { rx: /\btext-purple-500\b/g, rep: 'text-[#1a73e8]' },
  { rx: /\bbg-purple-600\b/g, rep: 'bg-[#1a73e8]' },
  { rx: /\bbg-purple-900\/30\b/g, rep: 'bg-blue-50' },
  { rx: /\bh-32 bg-white\/5\b/g, rep: 'h-32 bg-[#f8f9fa]' },
  { rx: /\bshadow-purple-500\/20\b/g, rep: 'shadow-blue-500/10' },
  { rx: /\bshadow-purple-500\/30\b/g, rep: 'shadow-blue-500/10' },
  { rx: /\bshadow-purple-500\/40\b/g, rep: 'shadow-blue-500/10' },
  { rx: /\btext-blue-400\b/g, rep: 'text-[#1a73e8]' },
];

files.forEach(file => {
  const ignorePaths = [
    'frontend/app/layout.tsx',
    'frontend/app/page.tsx', // Landing page, done
    'frontend/components/Navbar.tsx',
    'frontend/components/ui/EmptyState.tsx',
    'frontend/components/ui/Button.tsx',
    'frontend/components/ui/Card.tsx',
    'frontend/app/admin/page.tsx',
    'frontend/app/login/page.tsx',
    'frontend/app/signup/page.tsx',
    'frontend/app/dashboard/page.tsx'
  ];
  
  if (ignorePaths.some(p => file.endsWith(path.normalize(p)))) {
    return;
  }

  let content = fs.readFileSync(file, 'utf8');
  let newContent = content;
  replacements.forEach(({rx, rep}) => {
    newContent = newContent.replace(rx, rep);
  });
  
  if (content !== newContent) {
    fs.writeFileSync(file, newContent);
    console.log('Updated', file);
  }
});
console.log('Theme migration complete');
