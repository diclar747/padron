const Jimp = require('jimp');
const path = require('path');

async function makeIcon(size, outPath) {
  const image = new Jimp(size, size, '#0d6efd');
  const font = await Jimp.loadFont(Jimp.FONT_SANS_128_WHITE);
  const text = 'P';
  const textWidth = Jimp.measureText(font, text);
  const textHeight = Jimp.measureTextHeight(font, text, size);
  image.print(font, (size - textWidth) / 2, (size - textHeight) / 2, text);
  await image.writeAsync(outPath);
  console.log('Created', outPath);
}

(async () => {
  const outDir = path.join(__dirname, '../public/icons');
  await makeIcon(192, path.join(outDir, 'icon-192.png'));
  await makeIcon(512, path.join(outDir, 'icon-512.png'));
})();
