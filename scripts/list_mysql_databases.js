const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function run() {
  const db = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
  });

  const [dbs] = await db.query('SHOW DATABASES');
  console.log('Databases:', dbs);

  await db.end();
}

run().catch(console.error);
