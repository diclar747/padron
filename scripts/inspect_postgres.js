const { Pool } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

async function main() {
  const db = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to PostgreSQL...');
    
    // Check tables
    const tablesRes = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Tables in Postgres:', tablesRes.rows.map(r => r.table_name));

    // Get count of electores
    if (tablesRes.rows.some(r => r.table_name === 'mas_pda')) {
      const electoresCount = await db.query('SELECT COUNT(*) FROM mas_pda');
      console.log('Total electores in mas_pda:', electoresCount.rows[0].count);
      
      const sample = await db.query('SELECT * FROM mas_pda LIMIT 3');
      console.log('Sample elector:', sample.rows);
    }

    // Get count and sample of seccio
    if (tablesRes.rows.some(r => r.table_name === 'seccio')) {
      const seccioCount = await db.query('SELECT COUNT(*) FROM seccio');
      console.log('Total seccio:', seccioCount.rows[0].count);
      
      const sampleSec = await db.query('SELECT * FROM seccio LIMIT 5');
      console.log('Sample seccio:', sampleSec.rows);

      // Check if codes 61972 or 61974 exist
      const checkCodes = await db.query('SELECT * FROM seccio WHERE codigo_sec IN (61972, 61974)');
      console.log('Checking codes 61972/61974:', checkCodes.rows);
    }

    // Get count and sample of secc_local
    if (tablesRes.rows.some(r => r.table_name === 'secc_local')) {
      const seccLocalCount = await db.query('SELECT COUNT(*) FROM secc_local');
      console.log('Total secc_local:', seccLocalCount.rows[0].count);
      
      const sampleLoc = await db.query('SELECT * FROM secc_local LIMIT 5');
      console.log('Sample secc_local:', sampleLoc.rows);
    }

  } catch (err) {
    console.error('Error running query:', err);
  } finally {
    await db.end();
  }
}

main();
