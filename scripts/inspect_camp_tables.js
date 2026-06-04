const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
const lines = content.split('\n');

console.log('--- Lineas 1820 a 1880 de app.js ---');
for (let i = 1820; i <= 1880; i++) {
  console.log(`${i}: ${lines[i - 1]}`);
}
