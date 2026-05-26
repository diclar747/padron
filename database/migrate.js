require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

async function migrate() {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'padron_electoral',
    port: process.env.DB_PORT || 3306,
  });

  console.log('Iniciando migración de base de datos...');

  // Get table structure for usuarios
  const [columns] = await db.query('SHOW COLUMNS FROM usuarios');
  const columnNames = columns.map(c => c.Field);

  if (!columnNames.includes('telefono')) {
    console.log('Agregando columna "telefono"...');
    await db.query('ALTER TABLE usuarios ADD COLUMN telefono VARCHAR(50) DEFAULT NULL');
  }
  if (!columnNames.includes('direccion')) {
    console.log('Agregando columna "direccion"...');
    await db.query('ALTER TABLE usuarios ADD COLUMN direccion VARCHAR(255) DEFAULT NULL');
  }
  if (!columnNames.includes('avatar')) {
    console.log('Agregando columna "avatar"...');
    await db.query('ALTER TABLE usuarios ADD COLUMN avatar VARCHAR(255) DEFAULT NULL');
  }
  if (!columnNames.includes('permisos')) {
    console.log('Agregando columna "permisos"...');
    await db.query('ALTER TABLE usuarios ADD COLUMN permisos JSON DEFAULT NULL');
  }

  // Also, let's set default permissions for existing users
  console.log('Actualizando permisos por defecto de usuarios existentes...');
  const defaultPerms = JSON.stringify({
    dashboard: true,
    electores: true,
    cargar: true,
    mesas: true,
    mapa: true,
    logistica: true,
    emergencia: true
  });
  await db.query('UPDATE usuarios SET permisos = ? WHERE permisos IS NULL', [defaultPerms]);

  console.log('Migración completada con éxito.');
  await db.end();
}

migrate().catch(err => {
  console.error('Error durante la migración:', err);
  process.exit(1);
});
