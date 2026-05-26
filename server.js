require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL Neon pool
const db = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false }
});

// Wrap pg pool query to mimic mysql2 query signature
const originalQuery = db.query.bind(db);
db.query = async function(sql, params = []) {
  // Convert ? to $1, $2, etc.
  let index = 1;
  let pgSql = sql.replace(/\?/g, () => `$${index++}`);

  let isInsert = false;
  if (pgSql.trim().toUpperCase().startsWith('INSERT ')) {
    isInsert = true;
    // Evitar duplicar RETURNING si ya existe
    if (!pgSql.toUpperCase().includes('RETURNING')) {
      pgSql += ' RETURNING id';
    }
  }

  const res = await originalQuery(pgSql, params);

  const rows = res.rows || [];
  const result = [rows, res.fields];

  if (isInsert && rows.length > 0) {
    result.insertId = rows[0].id;
  } else {
    result.insertId = null;
  }
  result.affectedRows = res.rowCount;

  // Make sure properties can be read when destructuring or direct access
  Object.defineProperty(result, 'insertId', { value: result.insertId, enumerable: true });
  Object.defineProperty(result, 'affectedRows', { value: result.affectedRows, enumerable: true });

  return result;
};

// Attach db to requests
app.use((req, res, next) => {
  req.db = db;
  next();
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/electores', require('./routes/electores'));
app.use('/api/mesas', require('./routes/mesas'));
app.use('/api/barrios', require('./routes/barrios'));
app.use('/api/sync', require('./routes/sync'));
app.use('/api/reportes', require('./routes/reportes'));
app.use('/api/logistica', require('./routes/logistica'));
app.use('/api/incidencias', require('./routes/incidencias'));
app.use('/api/usuarios', require('./routes/usuarios'));

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await req.db.query('SELECT 1');
    res.json({ ok: true, db: 'connected' });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// SSE clients registry
const sseClients = new Set();
const broadcast = (data) => {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(client => {
    try {
      client.write(payload);
    } catch (e) {
      sseClients.delete(client);
    }
  });
};
app.set('broadcast', broadcast);

// SSE endpoint for real-time updates
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);
  send({ type: 'connected', time: new Date().toISOString() });

  sseClients.add(res);

  // Keep alive
  const interval = setInterval(() => send({ type: 'ping' }), 30000);

  req.on('close', () => {
    clearInterval(interval);
    sseClients.delete(res);
  });
});

app.listen(PORT, () => {
  console.log(`Servidor electoral corriendo en http://localhost:${PORT}`);
});

module.exports = app;
