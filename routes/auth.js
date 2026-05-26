const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const upload = require('../middleware/upload');
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'padron-electoral-secret-key-2024';

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Token requerido' });
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalido' });
  }
}

function checkPermiso(modulo) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'No autenticado' });
    
    // El rol admin tiene bypass total
    if (req.user.rol === 'admin') return next();
    
    // Consultar permisos actualizados desde la base de datos
    req.db.query('SELECT permisos FROM usuarios WHERE id = ?', [req.user.id])
      .then(([rows]) => {
        if (rows.length === 0) return res.status(401).json({ error: 'Usuario no encontrado' });
        const user = rows[0];
        let permisos = {};
        try {
          permisos = typeof user.permisos === 'string' ? JSON.parse(user.permisos) : (user.permisos || {});
        } catch (e) {
          permisos = {};
        }
        
        if (permisos[modulo] === true) {
          next();
        } else {
          res.status(403).json({ error: `No tienes permisos para acceder al módulo: ${modulo}` });
        }
      })
      .catch(err => {
        res.status(500).json({ error: err.message });
      });
  };
}

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [rows] = await req.db.query('SELECT * FROM usuarios WHERE email = ? AND activo = 1', [email]);
    if (rows.length === 0) return res.status(401).json({ error: 'Usuario no encontrado' });
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Contrasena incorrecta' });
    const token = jwt.sign({ id: user.id, rol: user.rol, nombre: user.nombre }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        nombre: user.nombre, 
        email: user.email, 
        rol: user.rol,
        telefono: user.telefono,
        direccion: user.direccion,
        avatar: user.avatar,
        permisos: typeof user.permisos === 'string' ? JSON.parse(user.permisos) : user.permisos
      } 
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Profile - Obtener datos del usuario logueado
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await req.db.query('SELECT id, nombre, email, rol, qr_uuid, telefono, direccion, avatar, permisos FROM usuarios WHERE id = ?', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    const user = rows[0];
    if (typeof user.permisos === 'string') {
      try { user.permisos = JSON.parse(user.permisos); } catch {}
    }
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Actualizar perfil del usuario logueado
router.put('/profile', authMiddleware, async (req, res) => {
  const { nombre, email, telefono, direccion, password, avatar } = req.body;
  try {
    // Verificar si el email ya existe en otro usuario
    const [emailCheck] = await req.db.query('SELECT id FROM usuarios WHERE email = ? AND id != ?', [email, req.user.id]);
    if (emailCheck.length > 0) {
      return res.status(400).json({ error: 'El correo electrónico ya está registrado por otro usuario' });
    }

    let query = 'UPDATE usuarios SET nombre = ?, email = ?, telefono = ?, direccion = ?';
    const params = [nombre, email, telefono || null, direccion || null];

    if (avatar !== undefined) {
      query += ', avatar = ?';
      params.push(avatar);
    }

    if (password && password.trim() !== '') {
      const password_hash = await bcrypt.hash(password, 10);
      query += ', password_hash = ?';
      params.push(password_hash);
    }

    query += ' WHERE id = ?';
    params.push(req.user.id);

    await req.db.query(query, params);

    // Retornar los datos actualizados
    const [rows] = await req.db.query('SELECT id, nombre, email, rol, qr_uuid, telefono, direccion, avatar, permisos FROM usuarios WHERE id = ?', [req.user.id]);
    const user = rows[0];
    if (typeof user.permisos === 'string') {
      try { user.permisos = JSON.parse(user.permisos); } catch {}
    }
    res.json({ success: true, user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Subir foto de perfil (avatar)
router.post('/avatar', authMiddleware, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });
    const avatarUrl = '/uploads/' + req.file.filename;
    res.json({ success: true, avatar_url: avatarUrl });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Verificar QR de Acreditacion
router.get('/verificar-qr/:uuid', authMiddleware, async (req, res) => {
  const { uuid } = req.params;
  try {
    const [rows] = await req.db.query('SELECT nombre, email, rol, qr_uuid, activo FROM usuarios WHERE qr_uuid = ?', [uuid]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Código QR no válido o usuario no registrado' });
    }
    res.json({ success: true, user: rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
module.exports.authMiddleware = authMiddleware;
module.exports.checkPermiso = checkPermiso;
