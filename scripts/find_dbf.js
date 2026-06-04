const fs = require('fs');
const path = require('path');

function searchForDbf(dir, depth = 0) {
  if (depth > 5) return; // Prevent searching too deep
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      let stat;
      try {
        stat = fs.statSync(filePath);
      } catch (e) {
        continue;
      }
      if (stat.isDirectory()) {
        // Skip common large directories to save time
        if (file === 'node_modules' || file === '.git' || file === 'AppData' || file === 'Microsoft' || file === 'Windows' || file === '$RECYCLE.BIN' || file === 'System Volume Information') {
          continue;
        }
        searchForDbf(filePath, depth + 1);
      } else if (stat.isFile() && file.toLowerCase().endsWith('.dbf')) {
        console.log(`Found DBF file: ${filePath} (${stat.size} bytes)`);
      }
    }
  } catch (e) {
    // Ignore read errors
  }
}

console.log('Searching for DBF files in C:/Users/Sate Core i5/Downloads...');
searchForDbf('c:/Users/Sate Core i5/Downloads');

console.log('Searching for DBF files in C:/Users/Sate Core i5/Desktop...');
searchForDbf('c:/Users/Sate Core i5/Desktop');

console.log('Searching for DBF files in D:/...');
searchForDbf('d:/');
