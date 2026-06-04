const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (file === 'node_modules' || file === '.git') continue;

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      searchDir(filePath);
    } else if (stat.isFile() && (file.endsWith('.js') || file.endsWith('.html') || file.endsWith('.json') || file.endsWith('.sql'))) {
      const content = fs.readFileSync(filePath, 'utf8');
      if (content.toLowerCase().includes('encarnacion')) {
        console.log(`Found mention of "encarnacion" in: ${filePath}`);
      }
    }
  }
}

searchDir('d:/localhost/padron');
