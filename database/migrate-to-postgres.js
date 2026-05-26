require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const { Client } = require('pg');

async function migrate() {
  console.log('Iniciando migración y transferencia de MySQL a PostgreSQL (Neon)...');

  // Conectar a MySQL local
  const mysqlConn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'padron_electoral',
    port: process.env.DB_PORT || 3306,
  });
  console.log('Conectado a MySQL local.');

  // Conectar a PostgreSQL Neon
  const pgClient = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await pgClient.connect();
  console.log('Conectado a Neon PostgreSQL.');

  // 1. Crear tablas en PostgreSQL
  console.log('Creando tablas en PostgreSQL...');

  await pgClient.query(`
    DROP TABLE IF EXISTS incidencias CASCADE;
    DROP TABLE IF EXISTS logistica_gastos CASCADE;
    DROP TABLE IF EXISTS logistica_traslados CASCADE;
    DROP TABLE IF EXISTS logistica_vehiculos CASCADE;
    DROP TABLE IF EXISTS mas_pda CASCADE;
    DROP TABLE IF EXISTS secc_local CASCADE;
    DROP TABLE IF EXISTS seccio CASCADE;
    DROP TABLE IF EXISTS usuarios CASCADE;
  `);

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
      secc_loc INT UNIQUE
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
      mesa INT,
      sec_loc INT,
      votado INT DEFAULT 0,
      observaciones TEXT,
      veedor_id INT,
      lat_voto DECIMAL(10,8) DEFAULT NULL,
      lng_voto DECIMAL(11,8) DEFAULT NULL,
      orden INT DEFAULT 999,
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

  console.log('Tablas creadas con éxito en PostgreSQL.');

  // 2. Transferencia de datos
  const tables = [
    { name: 'usuarios', cols: ['id', 'nombre', 'email', 'password_hash', 'rol', 'qr_uuid', 'activo', 'telefono', 'direccion', 'avatar', 'permisos', 'created_at'] },
    { name: 'seccio', cols: ['id', 'codigo_dep', 'ndepart', 'codigo_dis', 'ndistrito', 'zona', 'codigo_sec', 'descripcio', 'w_seccio', 'direccion', 'local_vota'] },
    { name: 'secc_local', cols: ['id', 'codigo_dep', 'codigo_dis', 'codigo_sec', 'codigo_loc', 'cod_local', 'nombre_loc', 'direccion', 'recibido', 'secc_loc'] },
    { name: 'mas_pda', cols: ['id', 'nombre', 'apellido', 'numero_ced', 'direccion', 'codigo_sec', 'mesa', 'sec_loc', 'votado', 'observaciones', 'veedor_id', 'lat_voto', 'lng_voto', 'orden'] },
    { name: 'logistica_vehiculos', cols: ['id', 'tipo', 'chofer', 'telefono', 'placa', 'combustible', 'lat', 'lng', 'activo', 'created_at'] },
    { name: 'logistica_traslados', cols: ['id', 'elector_id', 'vehiculo_id', 'estado', 'confirmado_por', 'created_at'] },
    { name: 'logistica_gastos', cols: ['id', 'concepto', 'monto', 'vehiculo_id', 'fecha', 'observaciones', 'barrio_id'] },
    { name: 'incidencias', cols: ['id', 'veedor_id', 'tipo', 'descripcion', 'lat', 'lng', 'foto_url', 'audio_url', 'barrio_id', 'created_at'] }
  ];

  for (const t of tables) {
    console.log(`Migrando tabla "${t.name}"...`);
    const [rows] = await mysqlConn.query(`SELECT * FROM ${t.name}`);
    console.log(`Leídos ${rows.length} registros de MySQL.`);

    if (rows.length === 0) continue;

    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      const valueParams = [];
      const valueStrings = [];
      let paramIndex = 1;

      for (const row of batch) {
        const rowVals = t.cols.map(col => {
          const rowKey = Object.keys(row).find(k => k.toLowerCase() === col.toLowerCase());
          let val = rowKey ? row[rowKey] : null;

          // Mapear booleanos
          if ((t.name === 'usuarios' || t.name === 'logistica_vehiculos') && col === 'activo') {
            val = val === 1 || val === true || val === '1';
          }
          // Parsear permisos si vienen como String en MySQL
          if (t.name === 'usuarios' && col === 'permisos' && typeof val === 'string') {
            try {
              val = JSON.parse(val);
            } catch (e) {
              // Si no se puede parsear, lo dejamos tal cual o como null
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
        console.error(`Error en lote de la tabla ${t.name} (rango ${i} - ${i + batch.length}):`, err);
        throw err;
      }
    }
    console.log(`Insertados todos los registros en PostgreSQL para la tabla "${t.name}".`);

    // Actualizar la secuencia de IDs de Postgres
    await pgClient.query(`SELECT setval(pg_get_serial_sequence('${t.name}', 'id'), COALESCE((SELECT MAX(id)+1 FROM ${t.name}), 1), false)`);
  }

  console.log('Migración de datos finalizada con éxito.');

  // Cerrar conexiones
  await mysqlConn.end();
  await pgClient.end();
  console.log('Conexiones cerradas.');
}

migrate().catch(err => {
  console.error('Error crítico durante la migración:', err);
  process.exit(1);
});
