import { chromium } from 'playwright';
import fs from 'fs';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto('https://www.harvardintech.com/', { waitUntil: 'networkidle', timeout: 60000 });
await page.evaluate(async () => {
  await new Promise((res) => { let y=0; const s=()=>{window.scrollBy(0,500);y+=500;if(y<document.body.scrollHeight)setTimeout(s,100);else res();}; s(); });
});
await page.waitForTimeout(1500);

// Capture full-res section crops by scrolling each region into a clip
const sections = [
  { name: 'live-whatsapp', top: 720, height: 760 },   // banner + apply text
  { name: 'live-getinvolved', top: 1600, height: 480 },
  { name: 'live-board', top: 2080, height: 560 },
  { name: 'live-support', top: 2630, height: 480 },
  { name: 'live-gallery-top', top: 3120, height: 760 },
  { name: 'live-gallery-mid', top: 3880, height: 760 },
  { name: 'live-gallery-bot', top: 4640, height: 760 },
  { name: 'live-contact', top: 5300, height: 308 },
];
for (const s of sections) {
  await page.screenshot({
    path: `/workspace/.codeyam/tmp/${s.name}.png`, fullPage: true,
    clip: { x: 0, y: s.top, width: 1280, height: s.height },
  });
}

// Extract gallery image URLs + section backgrounds
const data = await page.evaluate(() => {
  const galleryImgs = [...document.querySelectorAll('img')]
    .map((i) => i.currentSrc || i.src)
    .filter((s) => /h_200,w_200|h_200,q_80,w_200|h_200,w_200/.test(s));
  // dedup
  const gallery = [...new Set(galleryImgs)];
  // find background colors of section wrappers
  const bgs = [];
  document.querySelectorAll('section, [class*=row], [class*=block]').forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)') {
      const r = el.getBoundingClientRect();
      bgs.push({ top: Math.round(r.top + window.scrollY), h: Math.round(r.height), bg: cs.backgroundColor, cls: el.className.slice(0,40) });
    }
  });
  return { galleryCount: gallery.length, gallery, bgs };
});
fs.writeFileSync('/workspace/.codeyam/tmp/extract.json', JSON.stringify(data, null, 1));
console.log('gallery count:', data.galleryCount);
console.log('bgs:', JSON.stringify(data.bgs.slice(0, 40), null, 1));

await page.close();
await browser.close();
