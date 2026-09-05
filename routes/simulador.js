const express = require('express');
const { authMiddleware, checkPermiso } = require('./auth');
const router = express.Router();

// Distrito del simulacro (Elecciones Municipales 2026)
const DISTRITO = 'BELLA VISTA';

const normCi = (ci) => String(ci == null ? '' : ci).replace(/\D/g, '');
const ciValida = (ci) => /^\d{5,9}$/.test(normCi(ci));

const noTabla = (e) => /relation .*simulador_votos.* does not exist/i.test(e.message || '');
const handleErr = (res, e) => {
  if (noTabla(e)) {
    return res.status(503).json({ error: 'El simulador aún no está inicializado. Ejecutá: node scripts/migrate_simulador.js' });
  }
  return res.status(500).json({ error: e.message });
};

// Busca a la persona en el padrón real de Bella Vista (mas_pda + seccio).
async function buscarEnPadron(db, ci) {
  const [rows] = await db.query(
    `SELECT CONCAT(e.nombre, ' ', COALESCE(e.apellido, '')) AS nombre,
            e.mesa AS mesa,
            sl.nombre_loc AS local
       FROM mas_pda e
       LEFT JOIN seccio s ON e.codigo_sec = s.codigo_sec
       LEFT JOIN secc_local sl ON e.sec_loc = sl.secc_loc
      WHERE e.numero_ced = ? AND s.ndistrito = ?
      LIMIT 1`,
    [ci, DISTRITO]
  );
  return rows[0] || null;
}

// ------------------------------------------------------------------
// GET /api/simulador/estado?ci=XXXXXXX  (público)
//   ¿ya votó esta cédula? ¿está en el padrón de Bella Vista?
// ------------------------------------------------------------------
router.get('/estado', async (req, res) => {
  const ci = normCi(req.query.ci);
  if (!ciValida(ci)) return res.status(400).json({ error: 'Número de cédula inválido.' });
  try {
    const [prev] = await req.db.query('SELECT created_at FROM simulador_votos WHERE ci = ?', [ci]);
    const padron = await buscarEnPadron(req.db, ci);
    res.json({
      yaVoto: prev.length > 0,
      votadoEn: prev[0] ? prev[0].created_at : null,
      enPadron: !!padron,
      nombre: padron ? String(padron.nombre).trim() : null,
      mesa: padron ? padron.mesa : null,
      local: padron ? padron.local : null,
    });
  } catch (e) {
    handleErr(res, e);
  }
});

// ------------------------------------------------------------------
// POST /api/simulador/voto   (público)
//   body: { ci, intendente:{lista,candidato}, junta:{lista,preferencia,candidato}, device_id }
// ------------------------------------------------------------------
router.post('/voto', async (req, res) => {
  const b = req.body || {};
  const ci = normCi(b.ci);
  if (!ciValida(ci)) return res.status(400).json({ error: 'Número de cédula inválido.' });

  const intendente = b.intendente || {};
  const junta = b.junta || {};
  const intLista = String(intendente.lista || 'BLANCO').slice(0, 20);
  const junLista = String(junta.lista || 'BLANCO').slice(0, 20);
  const junPref = Number.isInteger(junta.preferencia) ? junta.preferencia : null;

  try {
    const [prev] = await req.db.query('SELECT id FROM simulador_votos WHERE ci = ?', [ci]);
    if (prev.length > 0) {
      return res.status(409).json({ error: 'Esta cédula ya emitió su voto en el simulacro.' });
    }

    const padron = await buscarEnPadron(req.db, ci);
    const enPadron = !!padron;
    const nombre = enPadron
      ? String(padron.nombre).trim().slice(0, 255)
      : (b.nombre ? String(b.nombre).slice(0, 255) : null);

    const ua = String(req.headers['user-agent'] || '').slice(0, 255);
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '')
      .split(',')[0].trim().slice(0, 64);

    await req.db.query(
      `INSERT INTO simulador_votos
        (ci, nombre, distrito, en_padron, mesa, local_voto,
         intendente_lista, intendente_candidato,
         junta_lista, junta_preferencia, junta_candidato,
         device_id, user_agent, ip)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        ci, nombre, DISTRITO, enPadron,
        enPadron ? padron.mesa : null,
        enPadron ? padron.local : null,
        intLista, intendente.candidato || null,
        junLista, junPref, junta.candidato || null,
        b.device_id ? String(b.device_id).slice(0, 64) : null, ua, ip,
      ]
    );

    const [[tot]] = await req.db.query('SELECT COUNT(*)::int AS n FROM simulador_votos');
    res.json({ ok: true, total: tot.n });
  } catch (e) {
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Esta cédula ya emitió su voto en el simulacro.' });
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
    const [[enPadron]] = await req.db.query(
      `SELECT COUNT(*)::int AS n FROM simulador_votos WHERE en_padron = true`
    );

    res.json({
      total: tot.n,
      enPadron: enPadron.n,
      fueraPadron: tot.n - enPadron.n,
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
    const [porMesa] = await req.db.query(
      `SELECT COALESCE(mesa::text, 's/d') AS mesa, COUNT(*)::int AS votos,
              SUM(CASE WHEN intendente_lista = '1' THEN 1 ELSE 0 END)::int AS intendente_lista1,
              SUM(CASE WHEN intendente_lista = 'BLANCO' THEN 1 ELSE 0 END)::int AS intendente_blanco
         FROM simulador_votos WHERE en_padron = true
        GROUP BY mesa ORDER BY mesa`
    );
    const [porLocal] = await req.db.query(
      `SELECT COALESCE(local_voto, 's/d') AS local, COUNT(*)::int AS votos
         FROM simulador_votos WHERE en_padron = true
        GROUP BY local_voto ORDER BY votos DESC`
    );
    const [porHora] = await req.db.query(
      `SELECT to_char(date_trunc('hour', created_at), 'YYYY-MM-DD HH24:00') AS hora, COUNT(*)::int AS votos
         FROM simulador_votos GROUP BY 1 ORDER BY 1`
    );
    res.json({ porMesa, porLocal, porHora });
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
