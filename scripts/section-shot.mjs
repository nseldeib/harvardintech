import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto('https://www.harvardintech.com/', { waitUntil: 'networkidle', timeout: 60000 });

// trigger fade-ins
await page.evaluate(async () => {
  await new Promise((res) => {
    let y = 0;
    const step = () => { window.scrollBy(0, 500); y += 500; if (y < document.body.scrollHeight) setTimeout(step, 100); else res(); };
    step();
  });
});
await page.waitForTimeout(1500);

// Dump the DOM outline: section/headers + their bounding boxes
const outline = await page.evaluate(() => {
  const out = [];
  const heads = document.querySelectorAll('h1,h2,h3,img');
  for (const el of heads) {
    const r = el.getBoundingClientRect();
    const top = r.top + window.scrollY;
    out.push({
      tag: el.tagName,
      text: (el.textContent || '').trim().slice(0, 60),
      src: el.getAttribute('src') ? el.getAttribute('src').slice(0, 120) : '',
      top: Math.round(top), h: Math.round(r.height), w: Math.round(r.width),
    });
  }
  return { docHeight: document.body.scrollHeight, items: out };
});
console.log(JSON.stringify(outline, null, 1));

await page.close();
await browser.close();
