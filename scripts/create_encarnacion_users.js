const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function main() {
  const dbName = process.env.DB_NAME || 'padron_electoral';
  console.log(`Conectando a MySQL local para sembrar usuarios de Encarnación en "${dbName}"...`);
  
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
    port: process.env.DB_PORT || 3306
  });

  const usersToSeed = [
    {
      nombre: 'Admin Encarnación',
      email: 'admin_encarnacion@padron.py',
      password: '123456',
      rol: 'admin',
      distrito: 'ENCARNACION',
      permisos: { dashboard: true, electores: true, cargar: true, mesas: true, mapa: true, logistica: true, emergencia: true }
    },
    {
      nombre: 'Veedor 1 Encarnación',
      email: 'veedor1_encarnacion@padron.py',
      password: '123456',
      rol: 'veedor',
      distrito: 'ENCARNACION',
      permisos: { dashboard: true, electores: true, cargar: true, mesas: true, mapa: true, logistica: false, emergencia: true }
    },
    {
      nombre: 'Veedor 2 Encarnación',
      email: 'veedor2_encarnacion@padron.py',
      password: '123456',
      rol: 'veedor',
      distrito: 'ENCARNACION',
      permisos: { dashboard: true, electores: true, cargar: true, mesas: true, mapa: true, logistica: false, emergencia: true }
    }
  ];

  for (const u of usersToSeed) {
    const [existing] = await conn.query('SELECT id FROM usuarios WHERE email = ?', [u.email]);
    if (existing.length === 0) {
      console.log(`Sembrando usuario: ${u.email}...`);
      const passwordHash = await bcrypt.hash(u.password, 10);
      const qrUuid = uuidv4();
      
      await conn.query(
        `INSERT INTO usuarios (nombre, email, password_hash, rol, qr_uuid, activo, permisos, distrito)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
        [u.nombre, u.email, passwordHash, u.rol, qrUuid, JSON.stringify(u.permisos), u.distrito]
      );
      console.log(`- Usuario ${u.email} creado con éxito.`);
    } else {
      console.log(`Usuario ${u.email} ya existe. Omitiendo.`);
    }
  }

  await conn.end();
  console.log('Sembrado de usuarios finalizado.');
}

main().catch(console.error);
