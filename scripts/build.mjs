import { cp, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = join(root, 'dist');
await mkdir(out, { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js', 'globe.js', 'assets']) {
  await cp(join(root, file), join(out, file), { recursive: true });
}
console.log('Статическая сборка готова: dist/');
