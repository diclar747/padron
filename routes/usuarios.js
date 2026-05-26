const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('./auth');
const router = express.Router();

// Middleware para verificar que el usuario sea administrador
function adminMiddleware(req, res, next) {
  if (req.user && req.user.rol === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Acceso denegado. Se requieren privilegios de administrador.' });
  }
}

// Todas las rutas de administración de usuarios requieren inicio de sesión y rol de administrador
router.use(authMiddleware);
router.use(adminMiddleware);

// GET /api/usuarios - Listar todos los usuarios
router.get('/', async (req, res) => {
  try {
    // Consultar el distrito real en DB del admin solicitante para máxima seguridad
    const [currentUserRows] = await req.db.query('SELECT distrito FROM usuarios WHERE id = ?', [req.user.id]);
    const currentDistrito = currentUserRows[0]?.distrito;

    let sql = 'SELECT id, nombre, email, rol, qr_uuid, activo, telefono, direccion, avatar, permisos, distrito, created_at FROM usuarios';
    const params = [];

    if (currentDistrito && currentDistrito !== 'TODOS') {
      sql += ' WHERE distrito = ?';
      params.push(currentDistrito);
    }

    sql += ' ORDER BY nombre';
    const [rows] = await req.db.query(sql, params);

    // Parsear permisos para cada usuario
    const users = rows.map(u => {
      if (typeof u.permisos === 'string') {
        try { u.permisos = JSON.parse(u.permisos); } catch { u.permisos = {}; }
      }
      return u;
    });
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/usuarios - Crear un nuevo usuario
router.post('/', async (req, res) => {
  const { nombre, email, password, rol, activo, telefono, direccion, avatar, permisos, distrito } = req.body;
  
  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Nombre, email y contraseña son requeridos' });
  }

  try {
    // Consultar el distrito real en DB del admin solicitante para máxima seguridad
    const [currentUserRows] = await req.db.query('SELECT distrito FROM usuarios WHERE id = ?', [req.user.id]);
    const currentDistrito = currentUserRows[0]?.distrito;

    // Verificar si el email ya existe
    const [existing] = await req.db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existing.length > 0) return res.status(400).json({ error: 'El correo electrónico ya existe' });

    const password_hash = await bcrypt.hash(password, 10);
    const qr_uuid = uuidv4();
    const isActivo = activo !== undefined ? (activo ? true : false) : true;
    const userRole = rol || 'veedor';
    
    // Si el administrador actual pertenece a un distrito, el nuevo usuario hereda ese distrito automáticamente
    let userDistrito = null;
    if (currentDistrito && currentDistrito !== 'TODOS') {
      userDistrito = currentDistrito;
    } else {
      userDistrito = distrito || null;
    }

    const userPerms = permisos ? JSON.stringify(permisos) : JSON.stringify({
      dashboard: true,
      electores: true,
      cargar: true,
      mesas: true,
      mapa: true,
      logistica: true,
      emergencia: true
    });

    const [r] = await req.db.query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol, qr_uuid, activo, telefono, direccion, avatar, permisos, distrito) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [nombre, email, password_hash, userRole, qr_uuid, isActivo, telefono || null, direccion || null, avatar || null, userPerms, userDistrito]
    );

    res.json({ id: r.insertId, success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /api/usuarios/:id - Actualizar usuario y permisos
router.put('/:id', async (req, res) => {
  const { nombre, email, password, rol, activo, telefono, direccion, avatar, permisos, distrito } = req.body;
  const userId = req.params.id;

  try {
    // Consultar el distrito real en DB del admin solicitante para máxima seguridad
    const [currentUserRows] = await req.db.query('SELECT distrito FROM usuarios WHERE id = ?', [req.user.id]);
    const currentDistrito = currentUserRows[0]?.distrito;

    // Verificar si existe el usuario
    const [user] = await req.db.query('SELECT * FROM usuarios WHERE id = ?', [userId]);
    if (user.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    const targetUser = user[0];

    // Control de seguridad: administrador de distrito no puede editar usuarios de otros distritos
    if (currentDistrito && currentDistrito !== 'TODOS' && targetUser.distrito !== currentDistrito) {
      return res.status(451) && res.status(403).json({ error: 'No tienes permiso para editar usuarios de otros distritos' });
    }

    // Verificar si el email ya existe en otro usuario
    const [existing] = await req.db.query('SELECT id FROM usuarios WHERE email = ? AND id != ?', [email, userId]);
    if (existing.length > 0) return res.status(400).json({ error: 'El correo electrónico ya está registrado por otro usuario' });

    let query = 'UPDATE usuarios SET nombre = ?, email = ?, rol = ?, activo = ?, telefono = ?, direccion = ?';
    const params = [nombre, email, rol, activo ? true : false, telefono || null, direccion || null];

    if (avatar !== undefined) {
      query += ', avatar = ?';
      params.push(avatar);
    }

    if (permisos) {
      query += ', permisos = ?';
      params.push(JSON.stringify(permisos));
    }

    if (password && password.trim() !== '') {
      const password_hash = await bcrypt.hash(password, 10);
      query += ', password_hash = ?';
      params.push(password_hash);
    }

    // Si es superadmin, permitir cambiar el distrito del usuario
    if (!currentDistrito || currentDistrito === 'TODOS') {
      query += ', distrito = ?';
      params.push(distrito || null);
    }

    query += ' WHERE id = ?';
    params.push(userId);

    await req.db.query(query, params);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/usuarios/:id - Eliminar usuario
router.delete('/:id', async (req, res) => {
  const userId = req.params.id;

  // Evitar eliminar al administrador inicial (ID 1) o a sí mismo
  if (parseInt(userId) === 1 || parseInt(userId) === req.user.id) {
    return res.status(400).json({ error: 'No es posible eliminar al administrador principal o a ti mismo.' });
  }

  try {
    // Consultar el distrito real en DB del admin solicitante para máxima seguridad
    const [currentUserRows] = await req.db.query('SELECT distrito FROM usuarios WHERE id = ?', [req.user.id]);
    const currentDistrito = currentUserRows[0]?.distrito;

    // Verificar si existe el usuario
    const [user] = await req.db.query('SELECT * FROM usuarios WHERE id = ?', [userId]);
    if (user.length === 0) return res.status(404).json({ error: 'Usuario no encontrado' });
    const targetUser = user[0];

    // Control de seguridad: administrador de distrito no puede eliminar usuarios de otros distritos
    if (currentDistrito && currentDistrito !== 'TODOS' && targetUser.distrito !== currentDistrito) {
      return res.status(403).json({ error: 'No tienes permiso para eliminar usuarios de otros distritos' });
    }

    await req.db.query('DELETE FROM usuarios WHERE id = ?', [userId]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
