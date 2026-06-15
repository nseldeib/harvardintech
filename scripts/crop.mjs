import { chromium } from 'playwright';
import fs from 'fs';

// crop.mjs <srcPath> <outPath> <sx> <sy> <sw> <sh>  (source-pixel coords)
const [src, out, sx, sy, sw, sh] = process.argv.slice(2);
const dataUrl = 'data:image/png;base64,' + fs.readFileSync(src).toString('base64');

const browser = await chromium.launch();
const page = await browser.newPage();
const result = await page.evaluate(async ({ dataUrl, sx, sy, sw, sh }) => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = dataUrl; });
  if (sw === '0') return { natW: img.naturalWidth, natH: img.naturalHeight, png: null };
  const c = document.createElement('canvas');
  c.width = +sw; c.height = +sh;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, +sx, +sy, +sw, +sh, 0, 0, +sw, +sh);
  return { natW: img.naturalWidth, natH: img.naturalHeight, png: c.toDataURL('image/png') };
}, { dataUrl, sx, sy, sw, sh });

if (result.png) {
  fs.writeFileSync(out, Buffer.from(result.png.split(',')[1], 'base64'));
}
console.log(JSON.stringify({ natW: result.natW, natH: result.natH, wrote: result.png ? out : null }));
await browser.close();
