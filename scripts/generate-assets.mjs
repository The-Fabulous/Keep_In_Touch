import { readFile, writeFile } from 'node:fs/promises';
const assets = new URL('../assets/', import.meta.url);
const land = JSON.parse(await readFile(new URL('land.geojson', assets), 'utf8'));
const polygons = land.features.flatMap(f => f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates]);
const contains = (x, y, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const bounded = polygons.map(rings => ({ rings, minX: Math.min(...rings[0].map(p => p[0])), maxX: Math.max(...rings[0].map(p => p[0])), minY: Math.min(...rings[0].map(p => p[1])), maxY: Math.max(...rings[0].map(p => p[1])) }));
const dots = [];
for (let lat = -86; lat < 86; lat += 1.6) {
  const step = 1.6 / Math.cos(lat * Math.PI / 180);
  for (let lon = -179; lon < 180; lon += step) {
    if (bounded.some(p => lon >= p.minX && lon <= p.maxX && lat >= p.minY && lat <= p.maxY && contains(lon, lat, p.rings[0]) && !p.rings.slice(1).some(ring => contains(lon, lat, ring)))) dots.push([+lon.toFixed(2), +lat.toFixed(2)]);
  }
}
await writeFile(new URL('land-dots.json', assets), JSON.stringify(dots));

const palettes = [
  ['#e3decf','#e7b28c','#453c38','#879779'],
  ['#e7dfef','#d5a17c','#342d36','#8b6ab0'],
  ['#e8e4d8','#ecc5a0','#8f583d','#bd8968'],
  ['#e4e9d7','#ce9a70','#493d2e','#7d8b62'],
  ['#e2e3ed','#e7bb9e','#272933','#7186a2'],
  ['#eee1d2','#b98058','#34302c','#a46f5a'],
  ['#e8dce1','#f0c5a0','#ac7149','#9b7d93']
];
for (let i = 0; i < palettes.length; i++) {
  const [bg, skin, hair, shirt] = palettes[i];
  const long = [1, 2, 6].includes(i);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><clipPath id="clip"><circle cx="50" cy="50" r="50"/></clipPath></defs><g clip-path="url(#clip)"><rect width="100" height="100" fill="${bg}"/><circle cx="77" cy="18" r="24" fill="#fff" opacity=".22"/>${long ? `<path d="M25 81V40c0-34 50-34 50 0v41" fill="${hair}"/>` : ''}<path d="M12 105c1-28 15-36 38-36s37 8 38 36" fill="${shirt}"/><path d="M42 59h16v16c-5 6-11 6-16 0" fill="${skin}"/><ellipse cx="50" cy="44" rx="21" ry="26" fill="${skin}"/><path d="M29 46c-8-22 4-34 22-34 20 0 26 14 20 34l-6-18c-11 8-21 7-31 4Z" fill="${hair}"/><path d="M40 44h2m16 0h2" stroke="#403733" stroke-width="2.5" stroke-linecap="round"/><path d="M46 57q4 3 8 0" fill="none" stroke="#985f53" stroke-width="1.5" stroke-linecap="round"/><path d="M42 75l8 10 8-10" fill="#fff" opacity=".7"/>${i === 0 || i === 3 ? '<g stroke="#514a40" stroke-width="1.5" fill="none"><rect x="33" y="39" width="13" height="10" rx="4"/><rect x="54" y="39" width="13" height="10" rx="4"/><path d="M46 43h8"/></g>' : ''}</g></svg>`;
  await writeFile(new URL(`avatar-${i}.svg`, assets), svg);
}
console.log(`Готово: ${dots.length} точек суши и 7 оригинальных SVG-аватаров.`);
