import { chromium } from 'playwright';

const targets = [
  { name: 'live', url: 'https://www.harvardintech.com/' },
  { name: 'ours', url: 'http://127.0.0.1:4321/' },
];

const browser = await chromium.launch();
for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(t.url, { waitUntil: 'networkidle', timeout: 60000 });
  } catch (e) {
    console.log(`${t.name}: goto warning ${e.message}`);
  }
  // Scroll through to trigger lazy/fade-in content
  await page.evaluate(async () => {
    await new Promise((res) => {
      let y = 0;
      const step = () => {
        window.scrollBy(0, 600);
        y += 600;
        if (y < document.body.scrollHeight) setTimeout(step, 120);
        else res();
      };
      step();
    });
  });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `/workspace/.codeyam/tmp/compare-${t.name}.png`, fullPage: true });
  console.log(`${t.name}: captured`);
  await page.close();
}
await browser.close();
