# Simulador de Voto — Máquina de Votación (Bella Vista 2026)

Réplica funcional del **simulador oficial del TSJE** (<https://simuladoroficial.tsje.gov.py>)
integrada al sistema Padrón Electoral. Sirve para **enseñar a votar** y, además,
funciona como **simulacro / encuesta**: al terminar, el voto se suma a un conteo
agregado y **cada cédula puede votar una sola vez**. Es **no oficial**.

## Archivos

| Ruta | Qué es |
|------|--------|
| `public/simulador.html` | Página pública del simulador (enlazada desde `index.html` y `app.html`). |
| `public/simulador/resultados.html` | Página de **resultados** del simulacro (conteo agregado + análisis). |
| `public/css/simulador.css` | Estilos de la "máquina", pantallas de guía y página de resultados. |
| `public/js/simulador.js` | Lógica: identificación → guía → votación por categorías → confirmación → envío al servidor. |
| `public/js/simulador-resultados.js` | Carga y dibuja los resultados (auto-refresco cada 20 s). |
| `routes/simulador.js` | API: `estado`, `voto`, `resultados`, `resultados/detalle`, `reset`. |
| `database/simulador.sql` · `scripts/migrate_simulador.js` | Crea la tabla `simulador_votos`. |
| `public/simulador/data/boleta-bella-vista.json` | Boleta que consume el simulador (generada, ver abajo). |
| `public/simulador/data/fuente-tsje/` | Copia cruda de los JSON oficiales del TSJE (fuente de datos). |
| `public/simulador/img/candidatos/*.webp` | Fotos oficiales de las candidaturas (TSJE). |
| `public/simulador/img/guia/*.png` | Ilustraciones oficiales de los pasos. |
| `scripts/build_boleta_simulador.mjs` | Genera `boleta-bella-vista.json` desde los datos del TSJE. |
| `scripts/seed_simulador_demo.js` | (pruebas) genera votos de demostración. |

## Contabilización de votos y anti-doble-voto

1. **Migración (una sola vez):**
   ```bash
   node scripts/migrate_simulador.js
   ```
   Crea `simulador_votos` con índice **único por cédula**.

2. **Flujo:** al abrir el simulador se pide el **número de cédula**. El backend
   (`GET /api/simulador/estado`) responde si esa cédula (a) ya votó y (b) figura en
   el padrón real de **Bella Vista** (`mas_pda` + `seccio`). Sólo los electores del
   distrito pueden participar (`EXIGIR_PADRON = true` en `simulador.js`; poné `false`
   para permitir a cualquiera). Si ya votó, se muestra la pantalla "Ya emitiste tu voto".

3. Al pulsar **Imprimir Selección**, `POST /api/simulador/voto` guarda el voto.
   La restricción de doble voto se aplica en **3 niveles**: verificación previa,
   índice `UNIQUE(ci)` en la BD (devuelve `409`) y marca local en el dispositivo.

4. **Resultados** — `public/simulador/resultados.html`:
   - `GET /api/simulador/resultados` — **público**, sólo agregados: total, % de
     participación sobre el padrón de Bella Vista, intendente por lista, junta por
     lista y ranking de concejales preferenciales.
   - `GET /api/simulador/resultados/detalle` — **requiere sesión** (permiso
     `dashboard`): desglose por mesa, por local y por hora. La página lo muestra
     sola si hay `token` en `localStorage`.
   - `POST /api/simulador/reset` — **sólo admin**: borra todos los votos (para
     dejar limpio antes del simulacro real). Alternativa en BD: `TRUNCATE simulador_votos;`

> El voto de la boleta es "secreto" de cara al público (los resultados son
> agregados), pero el registro guarda la cédula para impedir el doble voto y
> permitir el análisis interno por mesa/local. Dejarlo claro a los participantes.

## Cómo hace la simulación el TSJE (modelo replicado)

1. La portada (`index.html` del sitio oficial) es una **guía paso a paso**:
   presentar cédula → insertar boletín → **votar en la máquina** → verificar el
   impreso contra la pantalla → doblar y firmar → entintar el dedo y depositar en la urna.
2. El paso "votar" abre un iframe `app.html?ubicacion=<COD>`, donde `<COD>` es el
   distrito. **Bella Vista (Itapúa) = `59.7.3`**.
3. Ese iframe descarga por distrito:
   - `/datos/<COD>/Categorias.json` — cargos en juego. En municipales: `INT`
     (Intendente, selección simple) y `JUN` (Junta Municipal, lista con **1 voto
     preferente** — pantalla de "Opción 1..N").
   - `/datos/<COD>/Agrupaciones.json` — listas/partidos: número, nombre, sigla y
     **color** (`#ff0000` ANR, `#9adbf7` BVEM, `#98add4` PPI, `#ffa760` YOCREOCDN).
   - `/datos/<COD>/Candidaturas.json` — candidatos por cargo y por lista, con
     `nro_orden` y el `codigo` que da el nombre de la foto.
   - `/datos/<COD>/Boletas.json` — relación lista ↔ boleta.
   - `/constants/<COD>.json` — textos de UI, config y encabezado (Departamento,
     Distrito, Mesa).
4. Fotos: `/imagenes_candidaturas/paraguay_generales_municipales_2026/<codigo>.webp`.

La pantalla de la máquina: barra negra con la ubicación, barra blanca con el título
(`Candidatos a INTENDENTE MUNICIPAL` / `Listas participantes al cargo de JUNTA
MUNICIPAL`), grilla de listas con su color + `VOTO EN BLANCO`, botón negro
`Vista alto contraste` y `Volver Atrás`. Al terminar todas las categorías:
pantalla **"Opciones seleccionadas"** con un panel por cargo (botón `Modificar`),
`Reiniciar Selección` (naranja) e `Imprimir Selección` (verde).

## Regenerar la boleta

```bash
# sólo regenerar el JSON desde la fuente ya descargada
node scripts/build_boleta_simulador.mjs

# volver a bajar JSON + fotos del TSJE y regenerar
node scripts/build_boleta_simulador.mjs --fetch
```

### Qué candidatos aparecen

Para este ejemplo la boleta muestra **solo la Lista 1 (ANR)** — el intendente
**Euclides de Godois** y los **12 concejales del afiche de campaña**. Eso se
controla con `SOLO_LISTAS = ['1']` en el script; poné `[]` para incluir todas las
listas oficiales del distrito.

Los concejales de la Lista 1 usan los nombres del afiche (el dato del TSJE trae
variantes como "MARIA ARANDA" / "LUIS MATIAUDA"). Ver `ANR_JUN` / `NAME_FIX`.

La opción **"Voto en Blanco"** (que la máquina real siempre ofrece y no es un
candidato) se puede ocultar poniendo `mostrarVotoBlanco: false` en el script
(o directo en `boleta-bella-vista.json`).

## Otro distrito

Cambiar `LOC` en `scripts/build_boleta_simulador.mjs` por el código del distrito
(se ve en `ubicaciones.json` del sitio oficial o en el `?ubicacion=` del iframe),
correr con `--fetch`, y ajustar `departamento` / `distrito` / `mesa` en el script.
