const jimpModule = require('jimp');
const Jimp = jimpModule.Jimp || jimpModule;
const path = require('path');

async function processLogo() {
  const logoPath = path.join(__dirname, '../public/logo.png');
  const image = await Jimp.read(logoPath);
  const width = image.bitmap.width;
  const height = image.bitmap.height;
  const data = image.bitmap.data; // Buffer of RGBA values

  const visited = new Uint8Array(width * height);
  const queue = [];

  function isWhite(x, y) {
    const idx = (y * width + x) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];
    // White background is opaque (a > 0) and very bright
    return a > 0 && r > 200 && g > 200 && b > 200;
  }

  function makeTransparent(x, y) {
    const idx = (y * width + x) * 4;
    data[idx + 3] = 0; // Set Alpha to 0 (transparent)
  }

  // Push all pixels on the very borders of the image as starting points if they are white
  for (let x = 0; x < width; x++) {
    if (isWhite(x, 0)) {
      const key = 0 * width + x;
      visited[key] = 1;
      queue.push([x, 0]);
    }
    if (isWhite(x, height - 1)) {
      const key = (height - 1) * width + x;
      visited[key] = 1;
      queue.push([x, height - 1]);
    }
  }
  for (let y = 0; y < height; y++) {
    if (isWhite(0, y)) {
      const key = y * width + 0;
      visited[key] = 1;
      queue.push([0, y]);
    }
    if (isWhite(width - 1, y)) {
      const key = y * width + (width - 1);
      visited[key] = 1;
      queue.push([width - 1, y]);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const [x, y] = queue[head++];
    makeTransparent(x, y);

    // Neighbors
    const dirs = [
      [1, 0], [-1, 0], [0, 1], [0, -1]
    ];
    for (const [dx, dy] of dirs) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const nkey = ny * width + nx;
        if (!visited[nkey] && isWhite(nx, ny)) {
          visited[nkey] = 1;
          queue.push([nx, ny]);
        }
      }
    }
  }

  if (typeof image.writeAsync === 'function') {
    await image.writeAsync(logoPath);
  } else {
    await image.write(logoPath);
  }
  console.log(`Processed logo successfully. Background pixels removed: ${queue.length}`);
}

processLogo().catch(err => {
  console.error('Error processing logo:', err);
});
