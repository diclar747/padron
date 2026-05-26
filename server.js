require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

// MySQL pool
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'padron',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
});

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
