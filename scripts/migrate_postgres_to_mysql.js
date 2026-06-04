const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  console.log('--- Iniciando migración de PostgreSQL a MySQL Local ---');

  // 1. Conectar a MySQL para crear la base de datos
  const mysqlRoot = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT || 3306
  });
  
  const dbName = process.env.DB_NAME || 'padron_electoral';
  console.log(`Eliminando base de datos "${dbName}" si existe...`);
  await mysqlRoot.query(`DROP DATABASE IF EXISTS \`${dbName}\`;`);
  console.log(`Creando base de datos "${dbName}"...`);
  await mysqlRoot.query(`CREATE DATABASE \`${dbName}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;`);
  await mysqlRoot.end();

  // 2. Conectar a la base de datos mysql creada
  const mysqlConn = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
    port: process.env.DB_PORT || 3306,
    multipleStatements: true
  });
  console.log('Conectado a MySQL local.');

  // 3. Ejecutar schema_mysql.sql
  console.log('Creando estructura de tablas en MySQL local...');
  const schemaPath = path.join(__dirname, '../database/schema_mysql.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  
  try {
    await mysqlConn.query(schemaSql);
    console.log('Estructura de tablas creada con éxito.');
  } catch (err) {
    console.error('Error al ejecutar el esquema SQL:', err.message);
    throw err;
  }

  // 4. Conectar a PostgreSQL
  const pgClient = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await pgClient.connect();
  console.log('Conectado a PostgreSQL remoto (Neon).');

  // 5. Transferir datos en orden jerárquico
  const tablesToMigrate = [
    { name: 'usuarios', cols: ['id', 'nombre', 'email', 'password_hash', 'rol', 'qr_uuid', 'activo', 'telefono', 'direccion', 'avatar', 'permisos', 'distrito', 'created_at'] },
    { name: 'seccio', cols: ['id', 'codigo_dep', 'ndepart', 'codigo_dis', 'ndistrito', 'zona', 'codigo_sec', 'descripcio', 'w_seccio', 'direccion', 'local_vota'] },
    { name: 'secc_local', cols: ['id', 'codigo_dep', 'codigo_dis', 'codigo_sec', 'codigo_loc', 'cod_local', 'nombre_loc', 'direccion', 'recibido', 'secc_loc'] },
    { name: 'mas_pda', cols: ['id', 'nombre', 'apellido', 'numero_ced', 'direccion', 'codigo_sec', 'mesa', 'sec_loc', 'votado', 'observaciones', 'veedor_id', 'lat_voto', 'lng_voto', 'orden'] },
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
  ];

  for (const t of tablesToMigrate) {
    console.log(`Migrando datos de la tabla "${t.name}"...`);
    
    // Verificar si la tabla existe en PG
    const checkTable = await pgClient.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      )
    `, [t.name]);

    if (!checkTable.rows[0].exists) {
      console.log(`- La tabla "${t.name}" no existe en PostgreSQL. Omitiendo.`);
      continue;
    }

    const { rows } = await pgClient.query(`SELECT * FROM ${t.name}`);
    console.log(`- Leídos ${rows.length} registros de PostgreSQL.`);

    if (rows.length === 0) {
      console.log(`- Tabla "${t.name}" está vacía.`);
      continue;
    }

    // Limpiar tabla local en MySQL para evitar colisiones
    await mysqlConn.query(`SET FOREIGN_KEY_CHECKS = 0`);
    await mysqlConn.query(`TRUNCATE TABLE ${t.name}`);
    await mysqlConn.query(`SET FOREIGN_KEY_CHECKS = 1`);

    const placeholderArr = t.cols.map(() => '?').join(', ');
    const sqlInsert = `INSERT INTO ${t.name} (${t.cols.join(', ')}) VALUES (${placeholderArr})`;

    let insertedCount = 0;
    for (const row of rows) {
      const values = t.cols.map(col => {
        let val = row[col.toLowerCase()] !== undefined ? row[col.toLowerCase()] : null;

        // Tratar el JSON de permisos
        if (t.name === 'usuarios' && col === 'permisos' && typeof val === 'object' && val !== null) {
          val = JSON.stringify(val);
        }

        // Mapear booleanos a 1 o 0
        if (typeof val === 'boolean') {
          val = val ? 1 : 0;
        }

        return val;
      });

      try {
        await mysqlConn.query(sqlInsert, values);
        insertedCount++;
      } catch (err) {
        console.error(`Error al insertar fila en "${t.name}" (ID ${row.id}):`, err.message);
      }
    }
    console.log(`- Insertados con éxito ${insertedCount} de ${rows.length} registros en MySQL.`);
  }

  // Cerrar conexiones
  await mysqlConn.end();
  await pgClient.end();
  console.log('--- Migración de PostgreSQL a MySQL finalizada con éxito ---');
}

run().catch(err => {
  console.error('Error crítico durante la migración:', err);
  process.exit(1);
});
