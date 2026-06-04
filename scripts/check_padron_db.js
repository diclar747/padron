const mysql = require('mysql2/promise');

async function run() {
  const db = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'padron'
  });

  const [tables] = await db.query('SHOW TABLES');
  for (const t of tables) {
    const tableName = Object.values(t)[0];
    const [countRes] = await db.query(`SELECT COUNT(*) as count FROM ${tableName}`);
    console.log(`Table ${tableName} has ${countRes[0].count} rows.`);
  }

  // Check if there are any distritos in seccio or mesas or elsewhere
  // Let's check seccio or ndistrito if exists
  try {
    const [seccios] = await db.query('SELECT DISTINCT ndistrito FROM seccio');
    console.log('Distritos in seccio:', seccios);
  } catch(e) {
    console.log('No seccio table or error:', e.message);
  }

  await db.end();
}

run().catch(console.error);
