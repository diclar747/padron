const fs = require('fs');
const path = require('path');

function searchRoot(rootDir) {
  try {
    const files = fs.readdirSync(rootDir);
    for (const file of files) {
      if (file.toLowerCase().includes('dvd-padron') || file.toLowerCase().includes('padron2026')) {
        console.log(`Found matching folder/file in ${rootDir}: ${file}`);
      }
    }
  } catch (e) {
    // Ignore access errors
  }
}

console.log('Searching in C:...');
searchRoot('c:/');
searchRoot('c:/Users/Sate Core i5');
searchRoot('c:/Users/Sate Core i5/Downloads');

console.log('Searching in D:...');
searchRoot('d:/');
searchRoot('d:/localhost');
