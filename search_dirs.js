const fs = require('fs');
const path = require('path');

const rootDir = 'd:\\localhost';

function scan(dir) {
  try {
    const list = fs.readdirSync(dir);
    list.forEach(file => {
      if (['node_modules', '.git', '.next', 'dist', 'build', 'baileys_auth'].includes(file)) return;
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        if (file.toLowerCase().includes('ext') || file.toLowerCase().includes('sap') || file.toLowerCase().includes('zap')) {
          console.log('Dir match:', fullPath);
        }
        scan(fullPath);
      } else {
        if (file === 'manifest.json') {
          try {
            const content = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
            if (content.name && (content.name.toLowerCase().includes('win') || content.name.toLowerCase().includes('zap') || content.name.toLowerCase().includes('sap') || content.name.toLowerCase().includes('whats'))) {
              console.log('Manifest match:', fullPath, '=>', content.name);
            }
          } catch(e) {}
        }
      }
    });
  } catch(e) {}
}

console.log('Scanning directories for extensions...');
scan(rootDir);
console.log('Scan finished.');
