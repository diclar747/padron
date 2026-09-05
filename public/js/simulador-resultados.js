/* =====================================================================
   Resultados del Simulacro de Voto — Bella Vista 2026
   Conteo agregado (no oficial). Se actualiza solo cada 20 s.
   ===================================================================== */
(function () {
  'use strict';

  var API = '/api/simulador';
  var root = document.getElementById('resRoot');
  var actEl = document.getElementById('resActualizado');
  var refreshBtn = document.getElementById('resRefresh');
  var timer = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pct(n, total) { return total > 0 ? (n * 100 / total) : 0; }
  function fmt(n) { return (n || 0).toLocaleString('es-PY'); }

  function bar(label, value, total, color, sub) {
    var p = pct(value, total);
    return '' +
      '<div class="res-bar">' +
        '<div class="res-bar-top">' +
          '<span class="res-bar-label">' + esc(label) + (sub ? ' <em>' + esc(sub) + '</em>' : '') + '</span>' +
          '<span class="res-bar-val">' + fmt(value) + ' <b>' + p.toFixed(1) + '%</b></span>' +
        '</div>' +
        '<div class="res-bar-track"><div class="res-bar-fill" style="width:' + Math.max(p, value ? 1.5 : 0) + '%;background:' + color + '"></div></div>' +
      '</div>';
  }

  function labelIntendente(row) {
    if (row.lista === 'BLANCO') return { label: 'Voto en blanco', color: '#94a3b8' };
    return { label: (row.candidato || 'Lista ' + row.lista), color: '#dc2626', sub: 'Lista ' + row.lista };
  }
  function labelLista(row) {
    if (row.lista === 'BLANCO') return { label: 'Voto en blanco', color: '#94a3b8' };
    return { label: 'Lista ' + row.lista + ' · ANR', color: '#dc2626' };
  }

  function render(d) {
    var totalInt = (d.intendente || []).reduce(function (a, r) { return a + r.votos; }, 0);
    var totalJun = (d.juntaPorLista || []).reduce(function (a, r) { return a + r.votos; }, 0);
    var totalPref = (d.juntaPreferenciales || []).reduce(function (a, r) { return a + r.votos; }, 0);

    var intBars = (d.intendente || [])
      .sort(function (a, b) { return b.votos - a.votos; })
      .map(function (r) { var m = labelIntendente(r); return bar(m.label, r.votos, totalInt, m.color, m.sub); })
      .join('') || '<p class="res-empty">Sin votos todavía.</p>';

    var junBars = (d.juntaPorLista || [])
      .sort(function (a, b) { return b.votos - a.votos; })
      .map(function (r) { var m = labelLista(r); return bar(m.label, r.votos, totalJun, m.color); })
      .join('') || '<p class="res-empty">Sin votos todavía.</p>';

    var prefBars = (d.juntaPreferenciales || [])
      .slice()
      .sort(function (a, b) { return b.votos - a.votos; })
      .map(function (r) {
        return bar('Opción ' + r.opcion + ' — ' + (r.candidato || ''), r.votos, totalPref, '#b91c1c');
      })
      .join('') || '<p class="res-empty">Nadie eligió candidato preferente todavía.</p>';

    root.innerHTML =
      '<div class="res-kpis">' +
        kpi(fmt(d.total), 'Votos emitidos') +
        kpi(d.participacionPct.toFixed(1) + '%', 'Participación', 'sobre ' + fmt(d.padronBellaVista) + ' electores') +
        kpi(fmt(d.enPadron), 'Electores de Bella Vista') +
      '</div>' +

      '<section class="res-card">' +
        '<h3>Intendente Municipal</h3>' +
        intBars +
      '</section>' +

      '<section class="res-card">' +
        '<h3>Junta Municipal — por lista</h3>' +
        junBars +
      '</section>' +

      '<section class="res-card">' +
        '<h3>Junta Municipal — voto preferente a concejales</h3>' +
        '<p class="res-note">Ranking de las opciones marcadas dentro de la Lista 1.</p>' +
        prefBars +
      '</section>' +

      '<div id="resDetalleSlot"></div>';

    var t = null;
    try { t = localStorage.getItem('token'); } catch (e) {}
    if (t) montarDetalle(t);
  }

  function kpi(valor, etiqueta, extra) {
    return '<div class="res-kpi"><div class="res-kpi-val">' + esc(valor) + '</div>' +
      '<div class="res-kpi-lbl">' + esc(etiqueta) + '</div>' +
      (extra ? '<div class="res-kpi-extra">' + esc(extra) + '</div>' : '') + '</div>';
  }

  // ---- análisis detallado (requiere sesión) ----------------------
  function montarDetalle(token) {
    var slot = document.getElementById('resDetalleSlot');
    if (!slot) return;
    slot.innerHTML = '<button id="resDetBtn" class="res-btn wide">Ver análisis detallado (por mesa / local / hora)</button>';
    document.getElementById('resDetBtn').onclick = function () {
      var b = this; b.disabled = true; b.textContent = 'Cargando…';
      fetch(API + '/resultados/detalle', { headers: { Authorization: 'Bearer ' + token } })
        .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
        .then(function (res) {
          if (res.s !== 200) { b.disabled = false; b.textContent = 'Ver análisis detallado'; slot.insertAdjacentHTML('beforeend', '<p class="res-empty">' + esc(res.j.error || 'No disponible') + '</p>'); return; }
          slot.innerHTML = renderDetalle(res.j);
        })
        .catch(function () { b.disabled = false; b.textContent = 'Reintentar'; });
    };
  }

  function tabla(titulo, filas, cols) {
    if (!filas || !filas.length) return '<section class="res-card"><h3>' + esc(titulo) + '</h3><p class="res-empty">Sin datos.</p></section>';
    var head = '<tr>' + cols.map(function (c) { return '<th>' + esc(c.t) + '</th>'; }).join('') + '</tr>';
    var body = filas.map(function (f) {
      return '<tr>' + cols.map(function (c) { return '<td>' + esc(f[c.k] == null ? '—' : f[c.k]) + '</td>'; }).join('') + '</tr>';
    }).join('');
    return '<section class="res-card"><h3>' + esc(titulo) + '</h3>' +
      '<div class="res-tabla-wrap"><table class="res-tabla">' + head + body + '</table></div></section>';
  }

  function renderDetalle(d) {
    return '<div class="res-detalle">' +
      tabla('Por mesa', d.porMesa, [
        { t: 'Mesa', k: 'mesa' }, { t: 'Votos', k: 'votos' },
        { t: 'Intend. Lista 1', k: 'intendente_lista1' }, { t: 'Intend. Blanco', k: 'intendente_blanco' },
      ]) +
      tabla('Por local de votación', d.porLocal, [{ t: 'Local', k: 'local' }, { t: 'Votos', k: 'votos' }]) +
      tabla('Por hora', d.porHora, [{ t: 'Hora', k: 'hora' }, { t: 'Votos', k: 'votos' }]) +
      '</div>';
  }

  // ---- carga / auto-refresh ------------------------------------
  function cargar() {
    fetch(API + '/resultados', { cache: 'no-cache' })
      .then(function (r) { return r.json().then(function (j) { return { s: r.status, j: j }; }); })
      .then(function (res) {
        if (res.s !== 200) {
          root.innerHTML = '<div class="res-loading"><p>' + esc(res.j.error || 'No se pudieron cargar los resultados.') + '</p></div>';
          return;
        }
        render(res.j);
        actEl.textContent = 'Actualizado ' + new Date().toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      })
      .catch(function () {
        root.innerHTML = '<div class="res-loading"><p>Sin conexión con el servidor.</p></div>';
      });
  }

  refreshBtn.onclick = cargar;
  cargar();
  timer = setInterval(cargar, 20000);
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { clearInterval(timer); }
    else { cargar(); timer = setInterval(cargar, 20000); }
  });
})();
