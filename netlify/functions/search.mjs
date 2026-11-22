// Buscador de canciones del lado servidor (evita bloqueos de iOS / navegadores in-app).
// 1º iTunes Search API (ES), 2º Deezer como respaldo. Devuelve el formato de iTunes.
const cache = new Map();

async function itunes(term) {
  const url = 'https://itunes.apple.com/search?media=music&entity=song&limit=8&country=ES&term=' + encodeURIComponent(term);
  const r = await fetch(url, { headers: { 'User-Agent': 'playlist-navidad/1.0' } });
  if (!r.ok) throw new Error('itunes ' + r.status);
  const d = JSON.parse(await r.text());
  return (d.results || []).filter(x => x.kind === 'song');
}

async function deezer(term) {
  const r = await fetch('https://api.deezer.com/search?limit=8&q=' + encodeURIComponent(term));
  if (!r.ok) throw new Error('deezer ' + r.status);
  const d = await r.json();
  return (d.data || []).map(t => ({
    kind: 'song',
    trackName: t.title,
    artistName: t.artist && t.artist.name,
    collectionName: t.album && t.album.title,
    releaseDate: '',
    primaryGenreName: '',
    trackTimeMillis: (t.duration || 0) * 1000,
    artworkUrl100: t.album && t.album.cover_medium,
    trackId: 'dz' + t.id,
    previewUrl: t.preview
  }));
}

export default async (req) => {
  const term = (new URL(req.url).searchParams.get('term') || '').trim().slice(0, 100);
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=3600' };
  if (term.length < 2) return new Response(JSON.stringify({ results: [] }), { headers });
  const key = term.toLowerCase();
  if (cache.has(key)) return new Response(JSON.stringify({ results: cache.get(key), cached: true }), { headers });
  let results = [], source = 'itunes';
  try { results = await itunes(term); } catch (e) { results = []; }
  if (!results.length) {
    try { results = await deezer(term); source = 'deezer'; } catch (e) {}
  }
  if (results.length) { cache.set(key, results); if (cache.size > 500) cache.clear(); }
  return new Response(JSON.stringify({ results, source }), { headers });
};

export const config = { path: '/api/search' };
