const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function main() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT || 3306
  };

  try {
    console.log('Connecting to local MySQL:', config.host);
    const conn = await mysql.createConnection(config);

    // Show databases
    const [dbs] = await conn.query('SHOW DATABASES');
    console.log('Databases:', dbs.map(d => d.Database || d.SCHEMA_NAME));

    // Check if padron database exists
    const hasDb = dbs.some(d => (d.Database || d.SCHEMA_NAME) === 'padron');
    console.log('Does padron database exist?', hasDb);

    if (hasDb) {
      await conn.query('USE padron');
      const [tables] = await conn.query('SHOW TABLES');
      console.log('Tables in padron_electoral:', tables.map(t => Object.values(t)[0]));

      for (const t of tables.map(t => Object.values(t)[0])) {
        const [cnt] = await conn.query(`SELECT COUNT(*) as count FROM ${t}`);
        console.log(`Count in ${t}:`, cnt[0].count);
      }
    }

    await conn.end();
  } catch (err) {
    console.error('Error running MySQL query:', err);
  }
}

main();
