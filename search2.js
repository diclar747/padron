const fs = require('fs');
const path = require('path');

const targetDirs = [
  'd:\\localhost\\padron',
  'd:\\localhost\\wapi',
  'd:\\localhost\\whats-flow',
  'd:\\localhost\\Winsap'
];
const query = 'Winzap';

function searchFile(file) {
  try {
    const ext = path.extname(file).toLowerCase();
    if (['.js', '.html', '.css', '.json', '.txt', '.ts', '.tsx', '.py'].includes(ext)) {
      const content = fs.readFileSync(file, 'utf8');
      if (content.toLowerCase().includes(query.toLowerCase())) {
        console.log('Match found in:', file);
      }
    }
  } catch(e) {}
}

function traverse(dir) {
  try {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      if (['node_modules', '.git', '.next', 'dist', 'build', '.trae', 'baileys_auth'].includes(file)) return;
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        traverse(fullPath);
      } else {
        searchFile(fullPath);
      }
    });
  } catch(e) {}
}

console.log('Starting fast search...');
targetDirs.forEach(dir => {
  console.log('Scanning:', dir);
  traverse(dir);
});
console.log('Fast search finished.');
