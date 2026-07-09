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
  { rx: /\bbg-black\/20\b/g, rep: 'bg-white' },
  { rx: /\bhover:bg-white\/5\b/g, rep: 'hover:bg-blue-50' },
  { rx: /\bbg-purple-900\/20\b/g, rep: 'bg-purple-50' },
  { rx: /\bbg-red-900\/20\b/g, rep: 'bg-[#fce8e6]' },
  { rx: /\bbg-red-900\/30\b/g, rep: 'bg-[#fce8e6]' },
  { rx: /\bbg-yellow-900\/30\b/g, rep: 'bg-yellow-50' },
  { rx: /\btext-yellow-200\b/g, rep: 'text-yellow-700' },
  { rx: /\bborder-yellow-800\b/g, rep: 'border-yellow-200' },
  { rx: /\btext-gray-400\b/g, rep: 'text-[#5f6368]' },
  { rx: /\btext-gray-600\b/g, rep: 'text-[#5f6368]' },
  { rx: /\bfrom-purple-900\/10\b/g, rep: 'from-purple-50' },
  { rx: /\bto-blue-900\/10\b/g, rep: 'to-blue-50' },
  { rx: /\bshadow-purple-900\/20\b/g, rep: 'shadow-purple-100' },
  { rx: /\bring-purple-500\/50\b/g, rep: 'ring-purple-200' },
  { rx: /\bborder-purple-500\b/g, rep: 'border-purple-300' },
  { rx: /\bbg-slate-700\b/g, rep: 'bg-[#f8f9fa]' },
  { rx: /\btext-slate-700\b/g, rep: 'text-[#5f6368]' },
  { rx: /\btext-green-400\b/g, rep: 'text-[#1e8e3e]' },
  { rx: /\btext-red-400\b/g, rep: 'text-[#d93025]' },
  { rx: /\btext-yellow-400\b/g, rep: 'text-[#f9ab00]' },
  { rx: /\bbg-black\/10\b/g, rep: 'bg-[#f8f9fa]' },
  { rx: /\bfrom-green-900\/10\b/g, rep: 'from-green-50' },
  { rx: /\bfrom-rose-900\/10\b/g, rep: 'from-rose-50' },
  { rx: /\bto-teal-900\/10\b/g, rep: 'to-teal-50' },
  { rx: /\bto-pink-900\/10\b/g, rep: 'to-pink-50' },
  { rx: /\bfrom-amber-900\/10\b/g, rep: 'from-amber-50' },
  { rx: /\bto-orange-900\/10\b/g, rep: 'to-orange-50' },
  { rx: /\bborder-white\/20\b/g, rep: 'border-[#dadce0]' },
];

files.forEach(file => {
  const ignorePaths = [
    'frontend/app/layout.tsx',
    'frontend/app/page.tsx', 
    'frontend/components/Navbar.tsx',
    'frontend/app/admin/page.tsx',
    'frontend/app/dashboard/page.tsx',
    'frontend/app/login/page.tsx',
    'frontend/app/signup/page.tsx'
  ];
  
  if (ignorePaths.some(p => file.endsWith(path.normalize(p)))) {
    return;
  }

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
