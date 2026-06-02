const fs = require('fs');
const path = require('path');

const rootDir = 'd:\\localhost';
const query = 'Winzap';

function walk(dir, done) {
  let results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    let pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      if (file === 'node_modules' || file === '.git' || file === '.next' || file === 'dist' || file === 'build') {
        if (!--pending) done(null, results);
        return;
      }
      file = path.resolve(dir, file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          // Check file content
          try {
            if (file.endsWith('.js') || file.endsWith('.html') || file.endsWith('.css') || file.endsWith('.json') || file.endsWith('.txt')) {
              const content = fs.readFileSync(file, 'utf8');
              if (content.toLowerCase().includes(query.toLowerCase())) {
                results.push(file);
              }
            }
          } catch(e) {}
          if (!--pending) done(null, results);
        }
      });
    });
  });
}

console.log('Searching...');
walk(rootDir, (err, results) => {
  if (err) throw err;
  console.log('Results:', results);
});
