const express = require('express');
const { authMiddleware, checkPermiso } = require('./auth');
const router = express.Router();

// Distrito del simulacro (Elecciones Municipales 2026)
const DISTRITO = 'BELLA VISTA';

const noTabla = (e) => /relation .*simulador_votos.* does not exist/i.test(e.message || '');
const handleErr = (res, e) => {
  if (noTabla(e)) {
    return res.status(503).json({ error: 'El simulador aún no está inicializado. Ejecutá: node scripts/migrate_simulador.js' });
  }
  return res.status(500).json({ error: e.message });
};

const normDevice = (id) => String(id == null ? '' : id).trim().slice(0, 64);

// ------------------------------------------------------------------
// GET /api/simulador/estado?device_id=XXXX  (público)
//   ¿este dispositivo ya votó en el simulacro? No se pide cédula.
// ------------------------------------------------------------------
router.get('/estado', async (req, res) => {
  const deviceId = normDevice(req.query.device_id);
  if (!deviceId) return res.status(400).json({ error: 'Falta identificador de dispositivo.' });
  try {
    const [prev] = await req.db.query('SELECT created_at FROM simulador_votos WHERE device_id = ?', [deviceId]);
    res.json({
      yaVoto: prev.length > 0,
      votadoEn: prev[0] ? prev[0].created_at : null,
    });
  } catch (e) {
    handleErr(res, e);
  }
});

// ------------------------------------------------------------------
// POST /api/simulador/voto   (público, anónimo)
//   body: { device_id, intendente:{lista,candidato}, junta:{lista,preferencia,candidato} }
// ------------------------------------------------------------------
router.post('/voto', async (req, res) => {
  const b = req.body || {};
  const deviceId = normDevice(b.device_id);
  if (!deviceId) return res.status(400).json({ error: 'Falta identificador de dispositivo.' });

  const intendente = b.intendente || {};
  const junta = b.junta || {};
  const intLista = String(intendente.lista || 'BLANCO').slice(0, 20);
  const junLista = String(junta.lista || 'BLANCO').slice(0, 20);
  const junPref = Number.isInteger(junta.preferencia) ? junta.preferencia : null;

  try {
    const [prev] = await req.db.query('SELECT id FROM simulador_votos WHERE device_id = ?', [deviceId]);
    if (prev.length > 0) {
      return res.status(409).json({ error: 'Ya se emitió un voto desde este dispositivo en el simulacro.' });
    }

    const ua = String(req.headers['user-agent'] || '').slice(0, 255);
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
      .split(',')[0].trim().slice(0, 64);

    await req.db.query(
      `INSERT INTO simulador_votos
        (distrito, intendente_lista, intendente_candidato,
         junta_lista, junta_preferencia, junta_candidato,
         device_id, user_agent, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        DISTRITO,
        intLista, intendente.candidato || null,
        junLista, junPref, junta.candidato || null,
        deviceId, ua, ip,
      ]
    );

    const [[tot]] = await req.db.query('SELECT COUNT(*)::int AS n FROM simulador_votos');
    res.json({ ok: true, total: tot.n });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Ya se emitió un voto desde este dispositivo en el simulacro.' });
    }
    handleErr(res, e);
  }
});

// ------------------------------------------------------------------
// GET /api/simulador/resultados   (público — sólo agregados)
// ------------------------------------------------------------------
router.get('/resultados', async (req, res) => {
  try {
    const [[tot]] = await req.db.query('SELECT COUNT(*)::int AS n FROM simulador_votos');
    const [[padron]] = await req.db.query(
      `SELECT COUNT(*)::int AS n
         FROM mas_pda e LEFT JOIN seccio s ON e.codigo_sec = s.codigo_sec
        WHERE s.ndistrito = ?`, [DISTRITO]
    );
    const [intendente] = await req.db.query(
      `SELECT intendente_lista AS lista, MAX(intendente_candidato) AS candidato, COUNT(*)::int AS votos
         FROM simulador_votos GROUP BY intendente_lista ORDER BY votos DESC`
    );
    const [juntaPorLista] = await req.db.query(
      `SELECT junta_lista AS lista, COUNT(*)::int AS votos
         FROM simulador_votos GROUP BY junta_lista ORDER BY votos DESC`
    );
    const [juntaPreferenciales] = await req.db.query(
      `SELECT junta_preferencia AS opcion, MAX(junta_candidato) AS candidato, COUNT(*)::int AS votos
         FROM simulador_votos
        WHERE junta_lista <> 'BLANCO' AND junta_preferencia IS NOT NULL
        GROUP BY junta_preferencia ORDER BY junta_preferencia`
    );
    const [[ultimo]] = await req.db.query('SELECT MAX(created_at) AS t FROM simulador_votos');

    res.json({
      total: tot.n,
      padronBellaVista: padron.n,
      participacionPct: padron.n ? +((tot.n * 100) / padron.n).toFixed(2) : 0,
      actualizado: ultimo.t,
      intendente,
      juntaPorLista,
      juntaPreferenciales,
    });
  } catch (e) {
    handleErr(res, e);
  }
});

// ------------------------------------------------------------------
// GET /api/simulador/resultados/detalle   (requiere login + permiso dashboard)
//   desglose para análisis: por mesa, por local, por hora
// ------------------------------------------------------------------
router.get('/resultados/detalle', authMiddleware, checkPermiso('dashboard'), async (req, res) => {
  try {
    const [porHora] = await req.db.query(
      `SELECT to_char(date_trunc('hour', created_at), 'YYYY-MM-DD HH24:00') AS hora, COUNT(*)::int AS votos
         FROM simulador_votos GROUP BY 1 ORDER BY 1`
    );
    res.json({ porHora });
  } catch (e) {
    handleErr(res, e);
  }
});

// ------------------------------------------------------------------
// POST /api/simulador/reset   (solo admin) — limpia el simulacro
// ------------------------------------------------------------------
router.post('/reset', authMiddleware, async (req, res) => {
  if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Sólo administradores pueden reiniciar el simulacro.' });
  try {
    await req.db.query('DELETE FROM simulador_votos');
    res.json({ ok: true });
  } catch (e) {
    handleErr(res, e);
  }
});

module.exports = router;
