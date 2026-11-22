/**
 * Playlist Navidad Amigos 2026 — backend en Google Apps Script
 * Hoja: "Canciones" del Sheet "Playlist Navidad Amigos 2026"
 * Columnas: Fecha | Nombre | Canción | Artista | Álbum | Año | Estilo | Duración (s) | Portada | ID Apple | Estado Spotify | Dedicatoria
 *
 * doPost -> guarda hasta 3 canciones por envío
 * doGet  -> devuelve SOLO estadísticas agregadas (las canciones son sorpresa)
 */

const SHEET_ID = '1x0ppoAndTBi-ov-kAxVSp9l9fhZxMbaID7y-5PvcVik';
const SHEET_NAME = 'Canciones';
const MAX_POR_ENVIO = 3;

function hoja_() {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Evita inyección de fórmulas y limita longitud
function limpio_(v, max) {
  let s = String(v == null ? '' : v).trim().slice(0, max || 200);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents || '{}');
    const nombre = limpio_(data.nombre, 60);
    const dedicatoria = limpio_(data.dedicatoria, 200);
    const canciones = Array.isArray(data.canciones) ? data.canciones.slice(0, MAX_POR_ENVIO) : [];

    if (!nombre) return json_({ ok: false, error: 'Falta el nombre' });
    if (!canciones.length) return json_({ ok: false, error: 'No hay canciones' });

    const ahora = new Date();
    const filas = canciones
      .filter(c => c && c.trackName && c.artistName)
      .map(c => [
        ahora,
        nombre,
        limpio_(c.trackName),
        limpio_(c.artistName),
        limpio_(c.collectionName),
        c.releaseDate ? String(c.releaseDate).slice(0, 4) : '',
        limpio_(c.primaryGenreName, 60),
        c.trackTimeMillis ? Math.round(Number(c.trackTimeMillis) / 1000) : '',
        limpio_(c.artworkUrl100, 300),
        limpio_(c.trackId, 30),
        'Pendiente',
        dedicatoria
      ]);

    if (!filas.length) return json_({ ok: false, error: 'Canciones no válidas' });

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sh = hoja_();
      sh.getRange(sh.getLastRow() + 1, 1, filas.length, filas[0].length).setValues(filas);
    } finally {
      lock.releaseLock();
    }

    return json_({ ok: true, guardadas: filas.length, stats: stats_() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  try {
    return json_({ ok: true, stats: stats_() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function top_(mapa, n) {
  return Object.keys(mapa)
    .map(k => ({ nombre: mapa[k].label, n: mapa[k].n }))
    .sort((a, b) => b.n - a.n || a.nombre.localeCompare(b.nombre))
    .slice(0, n);
}

function suma_(mapa, clave, label) {
  if (!clave) return;
  if (!mapa[clave]) mapa[clave] = { label: label, n: 0 };
  mapa[clave].n++;
}

function stats_() {
  const sh = hoja_();
  const last = sh.getLastRow();
  const vacio = { personas: 0, canciones: 0, unicas: 0, minutos: 0, repetidas: 0,
                  estilos: [], artistas: [], decadas: [], anioMedio: null,
                  masAntigua: null, masNueva: null };
  if (last < 2) return vacio;

  const rows = sh.getRange(2, 1, last - 1, 10).getValues();
  const personas = {}, estilos = {}, artistas = {}, decadas = {}, temas = {};
  let segundos = 0, sumaAnios = 0, nAnios = 0, minA = null, maxA = null;

  rows.forEach(r => {
    const nombre = String(r[1]).trim().toLowerCase();
    const cancion = String(r[2]).trim();
    const artista = String(r[3]).trim();
    const anio = parseInt(r[5], 10);
    const estilo = String(r[6]).trim();
    const dur = Number(r[7]) || 0;
    if (!cancion) return;

    if (nombre) personas[nombre] = true;
    suma_(estilos, estilo.toLowerCase(), estilo);
    suma_(artistas, artista.toLowerCase(), artista);
    const tema = (r[9] ? String(r[9]) : (cancion + '|' + artista).toLowerCase());
    temas[tema] = (temas[tema] || 0) + 1;
    segundos += dur;
    if (anio > 1900 && anio < 2100) {
      sumaAnios += anio; nAnios++;
      const d = Math.floor(anio / 10) * 10;
      suma_(decadas, String(d), (d % 100 === 0 ? '00' : String(d).slice(2)) + 's');
      minA = minA === null ? anio : Math.min(minA, anio);
      maxA = maxA === null ? anio : Math.max(maxA, anio);
    }
  });

  const decadasOrden = Object.keys(decadas).sort()
    .map(k => ({ nombre: decadas[k].label, n: decadas[k].n, decada: Number(k) }));

  return {
    personas: Object.keys(personas).length,
    canciones: rows.filter(r => String(r[2]).trim()).length,
    unicas: Object.keys(temas).length,
    repetidas: Object.keys(temas).filter(k => temas[k] > 1).length,
    minutos: Math.round(segundos / 60),
    estilos: top_(estilos, 8),
    artistas: top_(artistas, 10),
    decadas: decadasOrden,
    anioMedio: nAnios ? Math.round(sumaAnios / nAnios) : null,
    masAntigua: minA,
    masNueva: maxA
  };
}
