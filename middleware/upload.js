const multer = require('multer');
const path = require('path');
const fs = require('fs');

// En Vercel (serverless) el filesystem es de solo lectura excepto /tmp
// En local usamos public/uploads para poder servirlos estáticamente
const isVercel = !!process.env.VERCEL;
const localUploadDir = path.join(__dirname, '../public/uploads');

let storage;
if (isVercel) {
  // Memoria en Vercel — los archivos no se persisten entre invocaciones
  storage = multer.memoryStorage();
} else {
  try {
    if (!fs.existsSync(localUploadDir)) fs.mkdirSync(localUploadDir, { recursive: true });
  } catch (_) { /* ignorar si no se puede crear */ }

  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, localUploadDir),
    filename: (req, file, cb) => {
      const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, unique + path.extname(file.originalname));
    }
  });
}

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });
module.exports = upload;
