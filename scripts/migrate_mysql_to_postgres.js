const mysql = require('mysql2/promise');
const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function run() {
  console.log('--- Iniciando migración de MySQL Local a PostgreSQL (Neon) ---');

  // 1. Conectar a MySQL local
  const mysqlConn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'padron_electoral',
    port: process.env.DB_PORT || 3306
  });
  console.log('Conectado a MySQL local.');

  // 2. Conectar a PostgreSQL (Neon)
  const pgClient = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await pgClient.connect();
  console.log('Conectado a Neon PostgreSQL.');

  // 3. Eliminar tablas existentes en Postgres
  console.log('Eliminando tablas existentes en PostgreSQL...');
  await pgClient.query(`
    DROP TABLE IF EXISTS sync_log CASCADE;
    DROP TABLE IF EXISTS camp_actividades CASCADE;
    DROP TABLE IF EXISTS camp_tareas CASCADE;
    DROP TABLE IF EXISTS camp_vehiculos CASCADE;
    DROP TABLE IF EXISTS camp_caja CASCADE;
    DROP TABLE IF EXISTS camp_gastos CASCADE;
    DROP TABLE IF EXISTS camp_presupuestos CASCADE;
    DROP TABLE IF EXISTS incidencias CASCADE;
    DROP TABLE IF EXISTS logistica_gastos CASCADE;
    DROP TABLE IF EXISTS logistica_traslados CASCADE;
    DROP TABLE IF EXISTS logistica_vehiculos CASCADE;
    DROP TABLE IF EXISTS mas_pda CASCADE;
    DROP TABLE IF EXISTS secc_local CASCADE;
    DROP TABLE IF EXISTS seccio CASCADE;
    DROP TABLE IF EXISTS usuarios CASCADE;
  `);

  // 4. Crear tablas con sintaxis de PostgreSQL
  console.log('Creando estructura de tablas en PostgreSQL...');
  
  await pgClient.query(`
    CREATE TABLE usuarios (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      rol VARCHAR(50) DEFAULT 'veedor',
      qr_uuid VARCHAR(36) UNIQUE,
      activo BOOLEAN DEFAULT TRUE,
      telefono VARCHAR(50) DEFAULT NULL,
      direccion VARCHAR(255) DEFAULT NULL,
      avatar VARCHAR(255) DEFAULT NULL,
      permisos JSONB DEFAULT NULL,
      distrito VARCHAR(100) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pgClient.query(`
    CREATE TABLE seccio (
      id SERIAL PRIMARY KEY,
      codigo_dep INT,
      ndepart VARCHAR(255),
      codigo_dis INT,
      ndistrito VARCHAR(255),
      zona INT,
      codigo_sec INT UNIQUE,
      descripcio VARCHAR(255),
      w_seccio VARCHAR(255),
      direccion VARCHAR(255),
      local_vota VARCHAR(255)
    );
  `);

  await pgClient.query(`
    CREATE TABLE secc_local (
      id SERIAL PRIMARY KEY,
      codigo_dep INT,
      codigo_dis INT,
      codigo_sec INT,
      codigo_loc INT,
      cod_local INT,
      nombre_loc VARCHAR(255),
      direccion VARCHAR(255),
      recibido VARCHAR(255),
      secc_loc INT UNIQUE,
      FOREIGN KEY (codigo_sec) REFERENCES seccio(codigo_sec) ON DELETE SET NULL
    );
  `);

  await pgClient.query(`
    CREATE TABLE mas_pda (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(255),
      apellido VARCHAR(255),
      numero_ced VARCHAR(50),
      direccion VARCHAR(255),
      codigo_sec INT,
      mesa INT DEFAULT 1,
      sec_loc INT,
      votado INT DEFAULT 0,
      observaciones TEXT,
      veedor_id INT,
      lat_voto DECIMAL(10,8) DEFAULT NULL,
      lng_voto DECIMAL(11,8) DEFAULT NULL,
      orden INT DEFAULT 999,
      telefono VARCHAR(50) DEFAULT NULL,
      FOREIGN KEY (codigo_sec) REFERENCES seccio(codigo_sec) ON DELETE SET NULL,
      FOREIGN KEY (sec_loc) REFERENCES secc_local(secc_loc) ON DELETE SET NULL,
      FOREIGN KEY (veedor_id) REFERENCES usuarios(id) ON DELETE SET NULL
    );
  `);

  await pgClient.query(`
    CREATE TABLE logistica_vehiculos (
      id SERIAL PRIMARY KEY,
      tipo VARCHAR(50) DEFAULT 'movil',
      chofer VARCHAR(255) NOT NULL,
      telefono VARCHAR(50) DEFAULT NULL,
      placa VARCHAR(50) DEFAULT NULL,
      combustible DECIMAL(10,2) DEFAULT 0,
      lat DECIMAL(10,8) DEFAULT NULL,
      lng DECIMAL(11,8) DEFAULT NULL,
      activo BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pgClient.query(`
    CREATE TABLE logistica_traslados (
      id SERIAL PRIMARY KEY,
      elector_id INT NOT NULL,
      vehiculo_id INT NOT NULL,
      estado VARCHAR(50) DEFAULT 'pendiente',
      confirmado_por INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (elector_id) REFERENCES mas_pda(id) ON DELETE CASCADE,
      FOREIGN KEY (vehiculo_id) REFERENCES logistica_vehiculos(id) ON DELETE CASCADE,
      FOREIGN KEY (confirmado_por) REFERENCES usuarios(id) ON DELETE SET NULL
    );
  `);

  await pgClient.query(`
    CREATE TABLE logistica_gastos (
      id SERIAL PRIMARY KEY,
      concepto VARCHAR(255) NOT NULL,
      monto DECIMAL(12,2) NOT NULL,
      vehiculo_id INT,
      fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      observaciones TEXT,
      barrio_id INT,
      FOREIGN KEY (vehiculo_id) REFERENCES logistica_vehiculos(id) ON DELETE SET NULL,
      FOREIGN KEY (barrio_id) REFERENCES seccio(codigo_sec) ON DELETE SET NULL
    );
  `);

  await pgClient.query(`
    CREATE TABLE incidencias (
      id SERIAL PRIMARY KEY,
      veedor_id INT DEFAULT NULL,
      tipo VARCHAR(50) DEFAULT 'incidente',
      descripcion TEXT DEFAULT NULL,
      lat DECIMAL(10,8) DEFAULT NULL,
      lng DECIMAL(11,8) DEFAULT NULL,
      foto_url VARCHAR(255) DEFAULT NULL,
      audio_url VARCHAR(255) DEFAULT NULL,
      barrio_id INT DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (veedor_id) REFERENCES usuarios(id) ON DELETE SET NULL,
      FOREIGN KEY (barrio_id) REFERENCES seccio(codigo_sec) ON DELETE SET NULL
    );
  `);

  await pgClient.query(`
    CREATE TABLE camp_presupuestos (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(255) NOT NULL,
      monto_total BIGINT NOT NULL DEFAULT 0,
      color VARCHAR(50) DEFAULT 'blue',
      descripcion TEXT,
      activo BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_by INT,
      FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL
    );
  `);

  await pgClient.query(`
    CREATE TABLE camp_vehiculos (
      id SERIAL PRIMARY KEY,
      nombre VARCHAR(255) NOT NULL,
      placa VARCHAR(255) DEFAULT NULL,
      modelo VARCHAR(255) DEFAULT NULL,
      chofer VARCHAR(255) DEFAULT NULL,
      telefono VARCHAR(255) DEFAULT NULL,
      capacidad INT DEFAULT 5,
      combustible INT DEFAULT 100,
      estado VARCHAR(255) DEFAULT 'disponible',
      observaciones TEXT,
      activo BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pgClient.query(`
    CREATE TABLE camp_gastos (
      id SERIAL PRIMARY KEY,
      presupuesto_id INT DEFAULT NULL,
      categoria VARCHAR(255) NOT NULL,
      monto BIGINT NOT NULL,
      descripcion TEXT,
      responsable_id INT,
      responsable_nombre VARCHAR(255),
      fecha DATE DEFAULT CURRENT_DATE,
      hora TIME DEFAULT CURRENT_TIME,
      foto_url TEXT,
      lat DECIMAL(10,8),
      lng DECIMAL(11,8),
      observaciones TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (presupuesto_id) REFERENCES camp_presupuestos(id) ON DELETE SET NULL,
      FOREIGN KEY (responsable_id) REFERENCES usuarios(id) ON DELETE SET NULL
    );
  `);

  await pgClient.query(`
    CREATE TABLE camp_caja (
      id SERIAL PRIMARY KEY,
      tipo VARCHAR(255) NOT NULL,
      monto BIGINT NOT NULL,
      descripcion TEXT,
      responsable_id INT,
      responsable_nombre VARCHAR(255),
      destinatario_nombre VARCHAR(255),
      fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      observaciones TEXT,
      FOREIGN KEY (responsable_id) REFERENCES usuarios(id) ON DELETE SET NULL
    );
  `);

  await pgClient.query(`
    CREATE TABLE camp_tareas (
      id SERIAL PRIMARY KEY,
      titulo VARCHAR(255) NOT NULL,
      descripcion TEXT,
      tipo VARCHAR(255),
      asignado_nombre VARCHAR(255),
      vehiculo_id INT,
      estado VARCHAR(255) DEFAULT 'pendiente',
      prioridad VARCHAR(255) DEFAULT 'normal',
      tiempo_estimado INT,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vehiculo_id) REFERENCES camp_vehiculos(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by) REFERENCES usuarios(id) ON DELETE SET NULL
    );
  `);

  await pgClient.query(`
    CREATE TABLE camp_actividades (
      id SERIAL PRIMARY KEY,
      tipo VARCHAR(255) NOT NULL,
      descripcion TEXT,
      categoria VARCHAR(255),
      vehiculo_id INT,
      responsable_id INT,
      responsable_nombre VARCHAR(255),
      lat DECIMAL(10,8),
      lng DECIMAL(11,8),
      fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (vehiculo_id) REFERENCES camp_vehiculos(id) ON DELETE SET NULL,
      FOREIGN KEY (responsable_id) REFERENCES usuarios(id) ON DELETE SET NULL
    );
  `);

  await pgClient.query(`
    CREATE TABLE sync_log (
      id SERIAL PRIMARY KEY,
      tabla VARCHAR(50) NOT NULL,
      operacion VARCHAR(20) NOT NULL,
      payload JSONB DEFAULT NULL,
      device_id VARCHAR(255) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log('Estructura de tablas en PostgreSQL creada.');

  // 5. Transferir datos
  const tables = [
    { name: 'usuarios', cols: ['id', 'nombre', 'email', 'password_hash', 'rol', 'qr_uuid', 'activo', 'telefono', 'direccion', 'avatar', 'permisos', 'distrito', 'created_at'] },
    { name: 'seccio', cols: ['id', 'codigo_dep', 'ndepart', 'codigo_dis', 'ndistrito', 'zona', 'codigo_sec', 'descripcio', 'w_seccio', 'direccion', 'local_vota'] },
    { name: 'secc_local', cols: ['id', 'codigo_dep', 'codigo_dis', 'codigo_sec', 'codigo_loc', 'cod_local', 'nombre_loc', 'direccion', 'recibido', 'secc_loc'] },
    { name: 'mas_pda', cols: ['id', 'nombre', 'apellido', 'numero_ced', 'direccion', 'codigo_sec', 'mesa', 'sec_loc', 'votado', 'observaciones', 'veedor_id', 'lat_voto', 'lng_voto', 'orden', 'telefono'] },
    { name: 'logistica_vehiculos', cols: ['id', 'tipo', 'chofer', 'telefono', 'placa', 'combustible', 'lat', 'lng', 'activo', 'created_at'] },
    { name: 'logistica_traslados', cols: ['id', 'elector_id', 'vehiculo_id', 'estado', 'confirmado_por', 'created_at'] },
    { name: 'logistica_gastos', cols: ['id', 'concepto', 'monto', 'vehiculo_id', 'fecha', 'observaciones', 'barrio_id'] },
    { name: 'incidencias', cols: ['id', 'veedor_id', 'tipo', 'descripcion', 'lat', 'lng', 'foto_url', 'audio_url', 'barrio_id', 'created_at'] },
    { name: 'camp_presupuestos', cols: ['id', 'nombre', 'monto_total', 'color', 'descripcion', 'activo', 'created_at', 'created_by'] },
    { name: 'camp_vehiculos', cols: ['id', 'nombre', 'placa', 'modelo', 'chofer', 'telefono', 'capacidad', 'combustible', 'estado', 'observaciones', 'activo', 'created_at'] },
    { name: 'camp_gastos', cols: ['id', 'presupuesto_id', 'categoria', 'monto', 'descripcion', 'responsable_id', 'responsable_nombre', 'fecha', 'hora', 'foto_url', 'lat', 'lng', 'observaciones', 'created_at'] },
    { name: 'camp_caja', cols: ['id', 'tipo', 'monto', 'descripcion', 'responsable_id', 'responsable_nombre', 'destinatario_nombre', 'fecha', 'observaciones'] },
    { name: 'camp_tareas', cols: ['id', 'titulo', 'descripcion', 'tipo', 'asignado_nombre', 'vehiculo_id', 'estado', 'prioridad', 'tiempo_estimado', 'created_by', 'created_at', 'updated_at'] },
    { name: 'camp_actividades', cols: ['id', 'tipo', 'descripcion', 'categoria', 'vehiculo_id', 'responsable_id', 'responsable_nombre', 'lat', 'lng', 'fecha', 'created_at'] },
    { name: 'sync_log', cols: ['id', 'tabla', 'operacion', 'payload', 'device_id', 'created_at'] }
  ];

  for (const t of tables) {
    console.log(`Migrando tabla "${t.name}"...`);
    const [rows] = await mysqlConn.query(`SELECT * FROM ${t.name}`);
    console.log(`- Leídos ${rows.length} registros de MySQL.`);

    if (rows.length === 0) {
      console.log(`- Tabla "${t.name}" vacía.`);
      continue;
    }

    const batchSize = 1000;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      const valueParams = [];
      const valueStrings = [];
      let paramIndex = 1;

      for (const row of batch) {
        const rowVals = t.cols.map(col => {
          let val = row[col] !== undefined ? row[col] : null;

          // Mapear booleanos a Postgres
          if ((t.name === 'usuarios' || t.name === 'logistica_vehiculos' || t.name === 'camp_presupuestos' || t.name === 'camp_vehiculos') && col === 'activo') {
            val = val === 1 || val === true;
          }
          // Parsear permisos/payload a objetos para pg JSONB
          if ((t.name === 'usuarios' && col === 'permisos') || (t.name === 'sync_log' && col === 'payload')) {
            if (typeof val === 'string') {
              try {
                val = JSON.parse(val);
              } catch (e) {}
            }
          }
          return val;
        });

        const placeholders = rowVals.map(() => `$${paramIndex++}`).join(', ');
        valueStrings.push(`(${placeholders})`);
        valueParams.push(...rowVals);
      }

      await pgClient.query('BEGIN');
      try {
        const sql = `INSERT INTO ${t.name} (${t.cols.join(', ')}) VALUES ${valueStrings.join(', ')}`;
        await pgClient.query(sql, valueParams);
        await pgClient.query('COMMIT');
      } catch (err) {
        await pgClient.query('ROLLBACK');
        console.error(`Error en lote de la tabla ${t.name} (rango ${i} - ${i + batch.length}):`, err.message);
        throw err;
      }
    }
    console.log(`- Insertados todos los registros de "${t.name}" en PostgreSQL.`);

    // Sincronizar el ID auto-incremental (secuencia SERIAL)
    await pgClient.query(`
      SELECT setval(
        pg_get_serial_sequence('${t.name}', 'id'), 
        COALESCE((SELECT MAX(id) FROM ${t.name}), 1), 
        true
      )
    `);
  }

  // Cerrar conexiones
  await mysqlConn.end();
  await pgClient.end();
  console.log('--- Migración a PostgreSQL (Neon) finalizada con éxito ---');
}

run().catch(err => {
  console.error('Error crítico durante la migración:', err);
  process.exit(1);
});
