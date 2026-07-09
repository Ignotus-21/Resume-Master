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

files.forEach(file => {
  const ignorePaths = [
    'frontend/app/layout.tsx',
    'frontend/app/page.tsx', 
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
  let originalContent = content;
  
  content = content.replace(/text-(slate|zinc)-(100|200|300)/g, 'text-[#202124]');
  content = content.replace(/text-(slate|zinc)-(400|500|600)/g, 'text-[#5f6368]');
  
  content = content.replace(/bg-(slate|zinc)-(600|700|800|900)(\/[0-9]+)?/g, 'bg-white');
  
  content = content.replace(/border-(slate|zinc)-(600|700|800|900)(\/[0-9]+)?/g, 'border-[#dadce0]');
  
  content = content.replace(/bg-blue-600 text-\[\#202124\]/g, 'bg-[#1a73e8] text-white');
  content = content.replace(/bg-blue-600 text-white/g, 'bg-[#1a73e8] text-white');
  
  content = content.replace(/bg-red-900\/50/g, 'bg-[#fce8e6]');
  content = content.replace(/border-red-800/g, 'border-[#d93025]');
  content = content.replace(/text-red-200/g, 'text-[#d93025]');
  
  content = content.replace(/text-emerald-400/g, 'text-[#1e8e3e]');
  content = content.replace(/bg-emerald-500\/20/g, 'bg-green-50');
  content = content.replace(/text-blue-400/g, 'text-[#1a73e8]');
  content = content.replace(/bg-blue-500\/20/g, 'bg-blue-50');

  if (content !== originalContent) {
    fs.writeFileSync(file, content);
    console.log('Updated', file);
  }
});
