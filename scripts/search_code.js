const fs = require('fs');
const path = require('path');

const content = fs.readFileSync(path.join(__dirname, '../public/js/app.js'), 'utf8');
const lines = content.split('\n');

console.log('--- Coincidencias de barriosData ---');
lines.forEach((line, index) => {
  if (line.includes('barriosData') || line.includes('renderMapa')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
