/* =====================================================================
 * build_boleta_simulador.mjs
 * ---------------------------------------------------------------------
 * Genera  public/simulador/data/boleta-bella-vista.json  a partir de los
 * datos oficiales del simulador del TSJE (simuladoroficial.tsje.gov.py).
 *
 * Cómo funciona el simulador oficial (modelo replicado):
 *   El simulador del TSJE es un iframe  app.html?ubicacion=<COD>  donde
 *   <COD> identifica el distrito (Bella Vista / Itapúa = "59.7.3").
 *   Ese iframe descarga 4 archivos JSON por distrito:
 *     /datos/<COD>/Categorias.json    -> cargos en juego (INT, JUN, ...)
 *     /datos/<COD>/Agrupaciones.json  -> listas / partidos (nro, color)
 *     /datos/<COD>/Candidaturas.json  -> candidatos por cargo y por lista
 *     /datos/<COD>/Boletas.json       -> relación lista <-> boleta
 *   y  /constants/<COD>.json  con textos, colores y config de UI.
 *   Las fotos salen de:
 *     /imagenes_candidaturas/paraguay_generales_municipales_2026/<codigo>.webp
 *
 * Uso:
 *   1) (opcional) refrescar la fuente:
 *        node scripts/build_boleta_simulador.mjs --fetch
 *      descarga los JSON e imágenes a public/simulador/data/fuente-tsje/
 *      y public/simulador/img/candidatos/
 *   2) generar la boleta usada por el simulador:
 *        node scripts/build_boleta_simulador.mjs
 *
 * Para otro distrito: cambiar LOC y (si aplica) los overrides de nombres.
 * ===================================================================== */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://simuladoroficial.tsje.gov.py';
const LOC = '59.7.3';                               // Bella Vista (Itapúa)
const JUEGO = 'paraguay_generales_municipales_2026';
const DATA_DIR = path.join(ROOT, 'public/simulador/data');
const SRC_DIR = path.join(DATA_DIR, 'fuente-tsje');
const IMG_DIR = path.join(ROOT, 'public/simulador/img/candidatos');

// Para este ejemplo la boleta muestra SOLO la Lista 1 (ANR): el intendente y los
// 12 concejales del afiche de campaña. Poné [] para incluir todas las listas.
const SOLO_LISTAS = ['1'];

// Nombres de los concejales de la Lista 1 (ANR) según el afiche de campaña.
// El dato oficial del TSJE trae variantes ("MARIA ARANDA", "LUIS MATIAUDA").
const ANR_JUN = [
  'NELSON ARMOA', 'LUCIO GONZÁLEZ', 'MARÍA ROSITA ARANDA', 'GLADYS AMARILLA',
  'CESNEN GRAU', 'JAVIER SILVERO', 'HÉCTOR CABRAL', 'ALDO ESCOBAR',
  'LUISITO MATIAUDA', 'JULIO DÁVALOS', 'JOSÉ BENÍTEZ', 'CELIA ESCOBAR',
];
const NAME_FIX = {
  'CESAR CARDOZO': 'CÉSAR CARDOZO',
  'NELSON ARIEL ALARCON ENCISO': 'NELSON ARIEL ALARCÓN ENCISO',
};

async function getJSON(p) {
  const r = await fetch(BASE + p);
  if (!r.ok) throw new Error(p + ' -> ' + r.status);
  return r.json();
}

async function fetchSource() {
  await mkdir(SRC_DIR, { recursive: true });
  await mkdir(IMG_DIR, { recursive: true });
  const files = ['Categorias', 'Candidaturas', 'Agrupaciones', 'Boletas'];
  for (const f of files) {
    const j = await getJSON(`/datos/${LOC}/${f}.json`);
    await writeFile(path.join(SRC_DIR, `tsje_${f}.json`), JSON.stringify(j, null, 2));
    console.log('fuente:', f, Array.isArray(j) ? j.length + ' items' : 'ok');
  }
  const consts = await getJSON(`/constants/${LOC}.json`);
  await writeFile(path.join(SRC_DIR, 'tsje_constants.json'), JSON.stringify(consts, null, 2));

  const cands = JSON.parse(await readFile(path.join(SRC_DIR, 'tsje_Candidaturas.json'), 'utf8'));
  const codes = new Set(cands.map(c => c.codigo).filter(c => /\d/.test(c)));
  codes.add('default_lista');
  for (const code of codes) {
    const url = `${BASE}/imagenes_candidaturas/${JUEGO}/${code}.webp`;
    const r = await fetch(url);
    if (!r.ok) { console.log('  img MISS', code, r.status); continue; }
    await writeFile(path.join(IMG_DIR, `${code}.webp`), Buffer.from(await r.arrayBuffer()));
  }
  console.log('imágenes:', codes.size);
}

async function build() {
  const rd = async f => JSON.parse(await readFile(path.join(SRC_DIR, f), 'utf8'));
  const cats = await rd('tsje_Categorias.json');
  const cands = await rd('tsje_Candidaturas.json');
  const agr = await rd('tsje_Agrupaciones.json');

  const listaMap = new Map();
  for (const a of agr) {
    if (!listaMap.has(a.numero)) {
      listaMap.set(a.numero, {
        numero: a.numero, nombre: a.nombre, sigla: a.nombre_corto,
        color: (a.color && a.color[0]) || '#dddddd',
        colorTexto: (a.color_tipografia && a.color_tipografia[0]) || '#000000',
        codigos: [a.codigo],
      });
    } else {
      listaMap.get(a.numero).codigos.push(a.codigo);
    }
  }

  const categorias = cats.sort((a, b) => a.posicion - b.posicion).map(cat => {
    const listas = [];
    for (const [numero, L] of listaMap) {
      if (SOLO_LISTAS.length && !SOLO_LISTAS.includes(numero)) continue;
      const cs = cands
        .filter(c => c.cod_categoria === cat.codigo && L.codigos.includes(c.cod_lista))
        .sort((a, b) => a.nro_orden - b.nro_orden)
        .map(c => {
          let nombre = NAME_FIX[c.nombre] || c.nombre;
          if (cat.codigo === 'JUN' && numero === '1') nombre = ANR_JUN[c.nro_orden - 1] || nombre;
          return { orden: c.nro_orden, nombre, img: c.codigo + '.webp' };
        });
      if (cs.length) {
        listas.push({ numero, nombre: L.nombre, sigla: L.sigla, color: L.color, colorTexto: L.colorTexto, candidatos: cs });
      }
    }
    return {
      codigo: cat.codigo, nombre: cat.nombre,
      preferente: !!cat.preferente, maxSelecciones: cat.max_selecciones || 1, listas,
    };
  });

  const boleta = {
    eleccion: 'ELECCIONES MUNICIPALES',
    anio: '2026 - 2031',
    departamento: '7 - ITAPÚA',
    distrito: '3 - BELLA VISTA',
    zona: '0 - BELLA VISTA',
    mesa: '9',
    // La máquina real siempre ofrece "Voto en Blanco" (no es un candidato).
    // Poné false si el ejemplo debe mostrar únicamente la lista.
    mostrarVotoBlanco: true,
    fuente: 'Datos oficiales TSJE — simuladoroficial.tsje.gov.py (ubicación ' + LOC + '). Uso educativo, no oficial.',
    imgBase: 'img/candidatos/',
    categorias,
  };

  await writeFile(path.join(DATA_DIR, 'boleta-bella-vista.json'), JSON.stringify(boleta, null, 2));
  console.log('OK -> public/simulador/data/boleta-bella-vista.json');
  categorias.forEach(c => console.log('  ' + c.codigo + ': ' + c.listas.length + ' listas, ' +
    c.listas.reduce((n, l) => n + l.candidatos.length, 0) + ' candidatos'));
}

if (process.argv.includes('--fetch')) await fetchSource();
await build();
