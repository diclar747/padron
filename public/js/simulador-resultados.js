/* =====================================================================
   Resultados del Simulacro de Voto — Bella Vista 2026
   Conteo agregado (no oficial). Se actualiza solo cada 20 s.
   Muestra siempre el padrón completo de candidatos (nombre + foto),
   aunque todavía no hayan recibido votos.
   ===================================================================== */
(function () {
  'use strict';

  var API = '/api/simulador';
  var DATA_URL = 'data/boleta-bella-vista.json';
  var root = document.getElementById('resRoot');
  var actEl = document.getElementById('resActualizado');
  var refreshBtn = document.getElementById('resRefresh');
  var timer = null;
  var boleta = null;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function pct(n, total) { return total > 0 ? (n * 100 / total) : 0; }
  function fmt(n) { return (n || 0).toLocaleString('es-PY'); }
  function fotoUrl(img) { return (boleta && boleta.imgBase ? boleta.imgBase : 'img/candidatos/') + img; }
  function categoria(codigo) { return (boleta.categorias || []).filter(function (c) { return c.codigo === codigo; })[0]; }
  function votosDeLista(rows, numero) {
    var r = (rows || []).filter(function (x) { return x.lista === numero; })[0];
    return r ? r.votos : 0;
  }

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

  function barFoto(label, foto, value, total, color, sub) {
    var p = pct(value, total);
    return '' +
      '<div class="res-bar res-bar-foto">' +
        '<img class="res-bar-img" src="' + esc(foto) + '" alt="" loading="lazy" onerror="this.classList.add(\'sin-foto\')">' +
        '<div class="res-bar-body">' +
          '<div class="res-bar-top">' +
            '<span class="res-bar-label">' + esc(label) + (sub ? ' <em>' + esc(sub) + '</em>' : '') + '</span>' +
            '<span class="res-bar-val">' + fmt(value) + ' <b>' + p.toFixed(1) + '%</b></span>' +
          '</div>' +
          '<div class="res-bar-track"><div class="res-bar-fill" style="width:' + Math.max(p, value ? 1.5 : 0) + '%;background:' + color + '"></div></div>' +
        '</div>' +
      '</div>';
  }

  function labelLista(row) {
    if (row.lista === 'BLANCO') return { label: 'Voto en blanco', color: '#94a3b8' };
    return { label: 'Lista ' + row.lista + ' · ANR', color: '#dc2626' };
  }

  // ---- Intendente: todas las listas/candidatos, con foto ------------
  function seccionIntendente(d) {
    var cat = categoria('INT');
    if (!cat) return '<p class="res-empty">Sin datos de la boleta.</p>';
    var totalInt = (d.intendente || []).reduce(function (a, r) { return a + r.votos; }, 0);
    var filas = [];
    (cat.listas || []).forEach(function (lista) {
      (lista.candidatos || []).forEach(function (c) {
        var votos = votosDeLista(d.intendente, lista.numero);
        filas.push(barFoto(c.nombre, fotoUrl(c.img), votos, totalInt, lista.color || '#dc2626', 'Lista ' + lista.numero + ' · ' + lista.sigla));
      });
    });
    filas.push(bar('Voto en blanco', votosDeLista(d.intendente, 'BLANCO'), totalInt, '#94a3b8'));
    return filas.join('');
  }

  // ---- Junta Municipal — total por lista (sin foto) ------------------
  function seccionJuntaPorLista(d) {
    var totalJun = (d.juntaPorLista || []).reduce(function (a, r) { return a + r.votos; }, 0);
    return (d.juntaPorLista || [])
      .slice()
      .sort(function (a, b) { return b.votos - a.votos; })
      .map(function (r) { var m = labelLista(r); return bar(m.label, r.votos, totalJun, m.color); })
      .join('') || '<p class="res-empty">Sin votos todavía.</p>';
  }

  // ---- Junta Municipal — ranking de concejales, con foto -------------
  function seccionPreferenciales(d) {
    var cat = categoria('JUN');
    if (!cat) return '<p class="res-empty">Sin datos de la boleta.</p>';
    var totalPref = (d.juntaPreferenciales || []).reduce(function (a, r) { return a + r.votos; }, 0);
    var items = [];
    (cat.listas || []).forEach(function (lista) {
      (lista.candidatos || []).forEach(function (c) {
        var row = (d.juntaPreferenciales || []).filter(function (r) { return r.opcion === c.orden; })[0];
        var votos = row ? row.votos : 0;
        items.push({ votos: votos, c: c, lista: lista });
      });
    });
    return items
      .sort(function (a, b) { return b.votos - a.votos; })
      .map(function (it) { return barFoto(it.c.nombre, fotoUrl(it.c.img), it.votos, totalPref, it.lista.color || '#b91c1c', 'Lista ' + it.lista.numero); })
      .join('');
  }

  function render(d) {
    root.innerHTML =
      '<div class="res-kpis">' +
        kpi(fmt(d.total), 'Votos emitidos') +
        kpi(d.participacionPct.toFixed(1) + '%', 'Participación') +
        kpi(fmt(d.padronBellaVista), 'Padrón de Bella Vista') +
      '</div>' +

      '<section class="res-card">' +
        '<h3>Intendente Municipal</h3>' +
        seccionIntendente(d) +
      '</section>' +

      '<section class="res-card">' +
        '<h3>Junta Municipal — por lista</h3>' +
        seccionJuntaPorLista(d) +
      '</section>' +

      '<section class="res-card">' +
        '<h3>Junta Municipal — voto preferente a concejales</h3>' +
        '<p class="res-note">Ranking de todos los candidatos de la Lista 1.</p>' +
        seccionPreferenciales(d) +
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
    slot.innerHTML = '<button id="resDetBtn" class="res-btn wide">Ver análisis detallado (por hora)</button>';
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

  function iniciar() {
    refreshBtn.onclick = cargar;
    cargar();
    timer = setInterval(cargar, 20000);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { clearInterval(timer); }
      else { cargar(); timer = setInterval(cargar, 20000); }
    });
  }

  fetch(DATA_URL, { cache: 'no-cache' })
    .then(function (r) { return r.json(); })
    .then(function (j) { boleta = j; iniciar(); })
    .catch(function () {
      root.innerHTML = '<div class="res-loading"><p>No se pudo cargar la boleta del simulacro.</p></div>';
    });
})();
