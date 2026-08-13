import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Resvg } from '@resvg/resvg-js';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const svg = readFileSync(join(dir, 'favicon.svg'));

for (const size of [192, 512]) {
  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'transparent',
  }).render().asPng();
  writeFileSync(join(dir, `icon-${size}.png`), png);
  console.log(`wrote icon-${size}.png (${png.length} bytes)`);
}
