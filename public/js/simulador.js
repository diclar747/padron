/* =====================================================================
   Simulador de Voto — Máquina de Votación (Boleta Única Electrónica)
   Réplica funcional del simulador oficial del TSJE para capacitación.
   Distrito: BELLA VISTA (Itapúa) — Elecciones Municipales 2026.
   Uso educativo / no oficial.
   ===================================================================== */
(function () {
  'use strict';

  var ASSET = 'simulador/';
  var DATA_URL = ASSET + 'data/boleta-bella-vista.json';
  var API = '/api/simulador';
  var RESULTADOS_URL = ASSET + 'resultados.html';

  var root = document.getElementById('simRoot');
  var boleta = null;

  // ---- estado -------------------------------------------------------
  var STEP = 'intro';                 // intro | ya_voto | g_cedula | g_insertar | maquina | g_verificar | g_doblar | g_tinta | gracias
  var maq = { view: 'categoria', catIndex: 0, prefLista: null, modificando: false };
  var sel = {};                       // { INT: {...}, JUN: {...} }
  var votante = null;                 // { votadoEn } — sólo cuando este dispositivo ya votó
  var votoEnviado = false;
  var enviando = false;
  var busy = false;                   // evita doble tap durante el feedback visual
  var FEEDBACK_MS = 160;              // igual que "tiempo_feedback" del TSJE
  var altoContraste = false;
  try { altoContraste = localStorage.getItem('sim_ac') === '1'; } catch (e) {}

  var deviceId = '';
  try {
    deviceId = localStorage.getItem('sim_device') || '';
    if (!deviceId) {
      deviceId = 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      localStorage.setItem('sim_device', deviceId);
    }
  } catch (e) {}

  // ---- guía (instructivo) ----------------------------------------------
  var GUIA = {
    intro: {
      dot: -1, grafico: ASSET + 'img/guia/maquina0_p6.png',
      html: '<b>Simulador del uso de la máquina de votación.</b>',
      big: null, btn: 'Comenzar', btnClase: 'verde', next: 'g_cedula'
    },
    g_cedula: {
      dot: 0, grafico: ASSET + 'img/guia/boleta-troquel.png',
      html: 'Presentá tu <b>cédula de identidad civil</b> a los miembros de la mesa receptora de votos, quienes te entregarán el <b>boletín</b> firmado por los dos vocales.',
      btn: 'Continuar', next: 'g_insertar'
    },
    g_insertar: {
      dot: 1, grafico: ASSET + 'img/guia/maquina2_p6.png',
      html: 'Colocá el <b>boletín</b> en la ranura como lo indica la flecha.',
      btn: 'Continuar', next: 'maquina'
    },
    g_verificar: {
      dot: 3, grafico: ASSET + 'img/guia/maquina_verificar_p6.png', boletin: true,
      html: 'Una vez impreso el boletín, <b>verificá</b> que el registro electrónico de tu voto coincida con la versión impresa, acercando el boletín al lector verificador.',
      btn: 'Continuar', next: 'g_doblar'
    },
    g_doblar: {
      dot: 4, grafico: ASSET + 'img/guia/dobla_voto.png',
      html: '<b>Doblá</b> el boletín de manera que se asegure el secreto del voto. <b>Entregá</b> al presidente de mesa para que lo firme.',
      btn: 'Continuar', next: 'g_tinta'
    },
    g_tinta: {
      dot: 5, grafico: ASSET + 'img/guia/info_tinta.png',
      html: '<b>Entintate</b> el dedo índice de la mano derecha. Recibí del presidente de mesa el boletín y <b>depositalo</b> en la urna plástica. Retirá tu cédula de identidad civil.',
      btn: 'Continuar', next: 'gracias'
    },
    gracias: {
      dot: 6, grafico: ASSET + 'img/guia/agradecimiento.png',
      big: 'El fortalecimiento de la<br><strong>Democracia</strong><br><small>está en nuestras manos</small>',
      html: 'Gracias por participar del simulacro de votación.',
      btn: 'Ver resultados', btnClase: 'verde', next: 'resultados',
      btn2: 'Empezar de nuevo', btn2Next: 'intro'
    }
  };
  var TOTAL_DOTS = 7;

  // ---- utilidades -------------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fotoUrl(img) { return ASSET + boleta.imgBase + img; }
  function categoriaActual() { return boleta.categorias[maq.catIndex]; }
  function tituloCategoria(cat) {
    return cat.preferente
      ? 'Listas participantes al cargo de ' + cat.nombre
      : 'Candidatos a ' + cat.nombre;
  }
  function toast(msg) {
    var t = document.getElementById('simToast');
    if (!t) { t = document.createElement('div'); t.id = 'simToast'; t.className = 'sim-toast'; document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  var ICON = {
    reiniciar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
    imprimir: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
    contraste: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20V2z"/><circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
    atras: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/></svg>',
    flecha: '<svg viewBox="0 0 24 24" width="64" height="64" fill="currentColor"><path d="M12 2l0 15M12 22l-8-9h16z" stroke="currentColor" stroke-width="1"/><path d="M11 2h2v13h-2z"/><path d="M4 13h16l-8 9z"/></svg>'
  };

  // ---- render principal ----------------------------------------------
  function render() {
    if (!boleta) return;
    if (STEP === 'maquina') { renderMaquina(); return; }
    if (STEP === 'ya_voto') { renderYaVoto(); return; }
    renderGuia(GUIA[STEP]);
  }

  function irA(step) {
    if (step === 'resultados') { window.location.href = RESULTADOS_URL; return; }
    if (step === 'maquina') {
      STEP = 'maquina';
      maq = { view: 'categoria', catIndex: 0, prefLista: null, modificando: false };
      sel = {}; busy = false; votoEnviado = false;
    } else if (step === 'intro') {
      STEP = 'intro'; sel = {}; votante = null; votoEnviado = false; enviando = false;
    } else {
      STEP = step;
    }
    render();
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function pantallaAbrir(claseExtra) {
    return '<div class="maquina"><div class="pantalla ' + (claseExtra || '') +
      (altoContraste ? ' alto-contraste' : '') + '" id="simPantalla">';
  }
  function pantallaCerrar() { return '</div></div>'; }

  // ---- pantallas de guía --------------------------------------------
  function renderGuia(g) {
    var dots = '';
    if (g.dot >= 0) {
      dots = '<div class="pasos">';
      for (var i = 0; i < TOTAL_DOTS; i++) dots += '<i class="' + (i === g.dot ? 'on' : '') + '"></i>';
      dots += '</div>';
    }
    var grafico = '<img class="grafico" src="' + esc(g.grafico) + '" alt="">';

    var centro = g.big
      ? '<div class="demo">' + g.big + '</div><h2>' + g.html + '</h2>'
      : grafico + '<h2>' + g.html + '</h2>';

    var boletin = g.boletin ? renderBoletin() : '';

    var btn2 = g.btn2
      ? '<button class="next ghost" id="simNext2">' + esc(g.btn2) + '</button>'
      : '';

    root.innerHTML =
      pantallaAbrir('is-guia') +
        '<div class="guia">' +
          dots +
          '<div class="guia-scroll">' + centro + boletin + '</div>' +
          '<div class="guia-botones">' +
            '<button class="next ' + (g.btnClase || '') + '" id="simNext">' + esc(g.btn) + '</button>' +
            btn2 +
          '</div>' +
        '</div>' +
      pantallaCerrar();

    document.getElementById('simNext').onclick = function () {
      if (g === GUIA.intro) { comenzar(); } else { irA(g.next); }
    };
    if (g.btn2) document.getElementById('simNext2').onclick = function () { irA(g.btn2Next); };
  }

  // ---- chequeo de doble voto por dispositivo (sin pedir cédula) -----
  function comenzar() {
    var btn = document.getElementById('simNext');
    if (btn) { btn.disabled = true; btn.textContent = 'Un momento…'; }
    fetch(API + '/estado?device_id=' + encodeURIComponent(deviceId))
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
      .then(function (res) {
        if (res.status === 200 && res.j.yaVoto) {
          votante = { votadoEn: res.j.votadoEn };
          STEP = 'ya_voto'; render(); return;
        }
        irA(GUIA.intro.next);
      })
      .catch(function () { irA(GUIA.intro.next); });
  }

  function renderBoletin() {
    var filas = boleta.categorias.map(function (cat) {
      var s = sel[cat.codigo];
      var val;
      if (!s) val = '—';
      else if (s.blanco) val = 'VOTO EN BLANCO';
      else val = 'Lista ' + s.numero + ' · ' + (s.cand ? s.cand.nombre : '');
      return '<div class="row"><b>' + esc(cat.nombre) + '</b><span>' + esc(val) + '</span></div>';
    }).join('');
    return '<div class="boletin">' +
        '<h4>Boletín de Voto</h4>' +
        '<div class="sub">' + esc(boleta.eleccion) + ' · ' + esc(boleta.distrito) + ' · Mesa ' + esc(boleta.mesa) + '</div>' +
        filas +
        '<div class="bc"></div>' +
        '<div class="foot">Verificá que coincida con la pantalla — uso no oficial</div>' +
      '</div>';
  }

  function fmtFecha(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ''; }
  }

  function renderYaVoto() {
    root.innerHTML =
      pantallaAbrir('is-guia') +
        '<div class="guia">' +
          '<div class="guia-scroll">' +
            '<div class="ident">' +
              '<div class="ident-ico ok">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>' +
              '</div>' +
              '<h2>Ya se emitió un voto en el simulacro desde este dispositivo</h2>' +
              '<p class="ident-sub">' +
                (votante && votante.votadoEn ? 'Registrado el ' + esc(fmtFecha(votante.votadoEn)) + '<br>' : '') +
                'Cada dispositivo puede votar una sola vez. ¡Gracias por participar!' +
              '</p>' +
              '<div class="guia-botones">' +
                '<button class="next verde" id="simYaRes">Ver resultados</button>' +
                '<button class="next ghost" id="simYaSalir">Salir</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      pantallaCerrar();
    document.getElementById('simYaRes').onclick = function () { window.location.href = RESULTADOS_URL; };
    document.getElementById('simYaSalir').onclick = function () { irA('intro'); };
  }

  // ---- envío del voto al servidor -------------------------------
  function selPayload(s) {
    if (!s || s.blanco) return { lista: 'BLANCO' };
    return {
      lista: s.numero,
      candidato: s.cand ? s.cand.nombre : null,
      preferencia: (s.cand && typeof s.cand.orden === 'number') ? s.cand.orden : null,
    };
  }

  function enviarVoto(cb) {
    if (votoEnviado) { cb(null); return; }
    if (enviando) return;
    enviando = true;
    var payload = {
      device_id: deviceId,
      intendente: selPayload(sel['INT']),
      junta: selPayload(sel['JUN']),
    };
    fetch(API + '/voto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json().then(function (j) { return { status: r.status, j: j }; }); })
      .then(function (res) {
        enviando = false;
        if (res.status === 200 && res.j.ok) {
          votoEnviado = true;
          cb(null);
        } else {
          var e = new Error(res.j.error || 'No se pudo registrar el voto.');
          e.status = res.status;
          cb(e);
        }
      })
      .catch(function () {
        enviando = false;
        var e = new Error('Sin conexión con el servidor. Reintentá.');
        e.status = 0;
        cb(e);
      });
  }

  // ---- máquina -----------------------------------------------------
  function renderMaquina() {
    var inner;
    if (maq.view === 'categoria') inner = viewCategoria();
    else if (maq.view === 'preferencia') inner = viewPreferencia();
    else if (maq.view === 'confirmacion') inner = viewConfirmacion();
    else if (maq.view === 'imprimiendo') inner = viewImprimiendo();

    root.innerHTML = pantallaAbrir() + headerMaquina() + inner + pantallaCerrar();
    wireMaquina();
  }

  function headerMaquina(tituloOverride) {
    var titulo = tituloOverride;
    if (titulo === undefined) {
      titulo = maq.view === 'confirmacion' ? 'Opciones seleccionadas'
        : maq.view === 'imprimiendo' ? ''
        : maq.view === 'preferencia' ? 'Candidatos a ' + categoriaActual().nombre
        : tituloCategoria(categoriaActual());
    }
    return '' +
      '<div class="m-header">' +
        '<div class="logo"><b>ELECCIONES</b><b>MUNICIPALES</b><span>' + esc(boleta.anio) + '</span></div>' +
        '<div class="ubic">' +
          '<span><i>Elección:</i> ' + esc(boleta.eleccion) + '</span>' +
          '<span><i>Departamento:</i> ' + esc(boleta.departamento) + '</span>' +
          '<span><i>Distrito:</i> ' + esc(boleta.distrito) + '</span>' +
          '<span><i>Mesa:</i> ' + esc(boleta.mesa) + '</span>' +
        '</div>' +
      '</div>' +
      (titulo !== '' ? '<div class="m-titulo">' + esc(titulo) + '</div>' : '');
  }

  function barra(botones) {
    return '<div class="m-barra">' + botones + '</div>';
  }
  function btnContraste() {
    return '<button class="m-btn negro" data-act="contraste">' + ICON.contraste + 'Vista alto contraste</button>';
  }
  function btnAtras(label) {
    return '<button class="m-btn gris" data-act="atras">' + ICON.atras + (label || 'Volver Atrás') + '</button>';
  }

  // -- pantalla de categoría (grilla de listas) --
  function viewCategoria() {
    var cat = categoriaActual();
    var cards = cat.listas.map(function (L) {
      if (cat.preferente) {
        return '<div class="lista-card grande" role="button" tabindex="0" ' +
          'aria-label="Lista ' + esc(L.numero) + ', ' + esc(L.nombre) + '" ' +
          'style="background:' + esc(L.color) + ';color:' + esc(L.colorTexto) + '" ' +
          'data-act="lista" data-lista="' + esc(L.numero) + '">' +
          '<div class="num"><b>LISTA ' + esc(L.numero) + '</b></div>' +
          '<div class="partido">' + esc(L.nombre) + '</div>' +
          '<div class="cand">' + esc(L.sigla) + '</div>' +
        '</div>';
      }
      var c = L.candidatos[0];
      return '<div class="lista-card" role="button" tabindex="0" ' +
        'aria-label="Lista ' + esc(L.numero) + ', ' + esc(L.nombre) + ', candidato ' + esc(c.nombre) + '" ' +
        'style="background:' + esc(L.color) + ';color:' + esc(L.colorTexto) + '" ' +
        'data-act="lista" data-lista="' + esc(L.numero) + '">' +
        '<div class="partido">' + esc(L.nombre) + '</div>' +
        '<div class="fila">' +
          '<img class="foto" src="' + esc(fotoUrl(c.img)) + '" alt="" loading="lazy">' +
          '<div class="num"><b>' + esc(L.numero) + '</b><span>' + esc(L.sigla) + '</span></div>' +
        '</div>' +
        '<div class="cand">' + esc(c.nombre) + '</div>' +
      '</div>';
    }).join('');

    var blanco = boleta.mostrarVotoBlanco === false ? ''
      : '<div class="lista-card blanco" role="button" tabindex="0" aria-label="Votar en blanco" data-act="blanco">VOTO EN BLANCO</div>';

    var botones = btnContraste() + '<span class="sp"></span>' +
      (maq.catIndex > 0 ? btnAtras() : '');

    var pocas = cat.listas.length <= 2 ? ' pocas' : '';
    return '<div class="m-body"><div class="listas-grid' + pocas + '">' + cards + blanco + '</div></div>' + barra(botones);
  }

  // -- pantalla de preferencia (Opción 1..N) --
  function viewPreferencia() {
    var cat = categoriaActual();
    var L = maq.prefLista;
    var cards = L.candidatos.map(function (c) {
      return '<div class="pref-card" role="button" tabindex="0" ' +
        'aria-label="Opción ' + esc(c.orden) + ', ' + esc(c.nombre) + '" ' +
        'data-act="pref" data-orden="' + esc(c.orden) + '">' +
        '<img class="foto" src="' + esc(fotoUrl(c.img)) + '" alt="" loading="lazy">' +
        '<div class="op">Opción <b>' + esc(c.orden) + '</b></div>' +
        '<div class="nm">' + esc(c.nombre) + '</div>' +
      '</div>';
    }).join('');

    var botones = btnContraste() + '<span class="sp"></span>' + btnAtras();

    return '<div class="m-body">' +
        '<div class="pref-head" style="background:' + esc(L.color) + ';color:' + esc(L.colorTexto) + '">' +
          '<b>LISTA ' + esc(L.numero) + '</b><span>' + esc(L.nombre) + '</span>' +
        '</div>' +
        '<div class="pref-grid">' + cards + '</div>' +
      '</div>' + barra(botones);
  }

  // -- pantalla de confirmación --
  function viewConfirmacion() {
    var cols = boleta.categorias.map(function (cat, idx) {
      var s = sel[cat.codigo];
      if (s && s.blanco) {
        return '<div class="conf-col" style="background:#6b7280">' +
          '<div class="cat">' + esc(cat.nombre) + '</div>' +
          '<div class="par" style="margin-top:auto">VOTO EN BLANCO</div>' +
          '<div style="margin-bottom:auto"></div>' +
          '<button class="mod" data-act="modificar" data-cat="' + idx + '">Modificar</button>' +
        '</div>';
      }
      return '<div class="conf-col" style="background:' + esc(s.color) + ';color:' + esc(s.colorTexto) + '">' +
        '<div class="cat">' + esc(cat.nombre) + '</div>' +
        '<div class="par">' + esc(s.nombre) + '</div>' +
        '<div class="lis">LISTA ' + esc(s.numero) + '</div>' +
        '<img class="foto" src="' + esc(fotoUrl(s.cand.img)) + '" alt="">' +
        '<div class="nom">' + esc(s.cand.nombre) + '</div>' +
        (cat.preferente ? '<div class="opc">Opción ' + esc(s.cand.orden) + '</div>' : '') +
        '<button class="mod" data-act="modificar" data-cat="' + idx + '">Modificar</button>' +
      '</div>';
    }).join('');

    return '<div class="m-body"><div class="conf-wrap">' +
        '<div class="conf-cols">' + cols + '</div>' +
        '<div class="conf-side">' +
          '<button class="m-btn naranja" data-act="reiniciar-sel">' + ICON.reiniciar + 'Reiniciar\nSelección</button>' +
          '<button class="m-btn verde" data-act="imprimir">' + ICON.imprimir + 'Imprimir\nSelección</button>' +
        '</div>' +
      '</div></div>';
  }

  function viewImprimiendo() {
    return '<div class="m-msg">' +
        '<div class="spinner"></div>' +
        '<h2>Se está imprimiendo su boletín de voto</h2>' +
        '<p>No retire el boletín hasta que se le indique.</p>' +
      '</div>';
  }

  // ---- eventos de la máquina --------------------------------------
  function wireMaquina() {
    var p = document.getElementById('simPantalla');
    if (!p) return;
    p.addEventListener('click', function (ev) {
      var el = ev.target.closest('[data-act]');
      if (el) handleAct(el);
    });
    // accesibilidad: Enter / Espacio sobre tarjetas y botones enfocables
    p.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ' && ev.key !== 'Spacebar') return;
      var el = ev.target.closest('[data-act]');
      if (!el) return;
      ev.preventDefault();
      handleAct(el);
    });
  }

  function handleAct(el) {
    if (busy) return;
    var act = el.getAttribute('data-act');

    // acciones inmediatas (sin feedback de "voto")
    if (act === 'contraste') {
      altoContraste = !altoContraste;
      try { localStorage.setItem('sim_ac', altoContraste ? '1' : '0'); } catch (e) {}
      renderMaquina();
      return;
    }
    if (act === 'atras') {
      if (maq.view === 'preferencia') { maq.view = 'categoria'; maq.prefLista = null; }
      else if (maq.modificando) { maq.view = 'confirmacion'; maq.modificando = false; }
      else if (maq.catIndex > 0) { maq.catIndex--; maq.view = 'categoria'; }
      renderMaquina();
      return;
    }
    if (act === 'modificar') {
      maq.catIndex = parseInt(el.getAttribute('data-cat'), 10);
      maq.view = 'categoria';
      maq.prefLista = null;
      maq.modificando = true;
      renderMaquina();
      return;
    }
    if (act === 'reiniciar-sel') {
      sel = {};
      maq = { view: 'categoria', catIndex: 0, prefLista: null, modificando: false };
      renderMaquina();
      toast('Selección reiniciada');
      return;
    }
    if (act === 'imprimir') {
      maq.view = 'imprimiendo';
      renderMaquina();
      enviarVoto(function (err) {
        if (err) {
          if (err.status === 409) { STEP = 'ya_voto'; render(); return; }
          maq.view = 'confirmacion';
          renderMaquina();
          toast(err.message || 'No se pudo registrar el voto. Reintentá.');
          return;
        }
        setTimeout(function () {
          STEP = 'g_verificar';
          render();
          root.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 900);
      });
      return;
    }

    // acciones de selección: destello breve antes de avanzar (como la máquina real)
    if (act === 'lista' || act === 'pref' || act === 'blanco') {
      busy = true;
      el.classList.add('sel');
      setTimeout(function () { aplicarSeleccion(act, el); busy = false; }, FEEDBACK_MS);
    }
  }

  function aplicarSeleccion(act, el) {
    var cat = categoriaActual();

    if (act === 'blanco') {
      sel[cat.codigo] = { blanco: true };
      avanzarCategoria();
      return;
    }

    if (act === 'lista') {
      var numero = el.getAttribute('data-lista');
      var L = cat.listas.filter(function (x) { return x.numero === numero; })[0];
      if (!L) return;
      if (cat.preferente) {
        maq.prefLista = L;
        maq.view = 'preferencia';
        renderMaquina();
      } else {
        sel[cat.codigo] = {
          numero: L.numero, sigla: L.sigla, nombre: L.nombre,
          color: L.color, colorTexto: L.colorTexto, cand: L.candidatos[0]
        };
        avanzarCategoria();
      }
      return;
    }

    if (act === 'pref') {
      var orden = parseInt(el.getAttribute('data-orden'), 10);
      var L2 = maq.prefLista;
      var c = L2.candidatos.filter(function (x) { return x.orden === orden; })[0];
      sel[cat.codigo] = {
        numero: L2.numero, sigla: L2.sigla, nombre: L2.nombre,
        color: L2.color, colorTexto: L2.colorTexto, cand: c
      };
      maq.prefLista = null;
      avanzarCategoria();
    }
  }

  function avanzarCategoria() {
    if (maq.modificando) {
      maq.modificando = false;
      maq.view = 'confirmacion';
    } else if (maq.catIndex < boleta.categorias.length - 1) {
      maq.catIndex++;
      maq.view = 'categoria';
    } else {
      maq.view = 'confirmacion';
    }
    renderMaquina();
  }

  // ---- init -------------------------------------------------------
  function boot() {
    root.innerHTML = pantallaAbrir('is-guia') +
      '<div class="m-msg"><div class="spinner"></div><h2>Cargando simulador…</h2></div>' +
      pantallaCerrar();

    fetch(DATA_URL, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (j) {
        boleta = j;
        var f = document.getElementById('simFuente');
        if (f) f.textContent = j.fuente || '';
        STEP = 'intro';
        render();
      })
      .catch(function (err) {
        root.innerHTML = pantallaAbrir('is-guia') +
          '<div class="m-msg"><h2>No se pudo cargar la boleta</h2><p>' + esc(err.message) + '</p></div>' +
          pantallaCerrar();
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
