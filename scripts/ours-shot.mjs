import { chromium } from 'playwright';
const sections = JSON.parse(process.argv[2]); // [{name, top, height}]
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto('http://127.0.0.1:4321/', { waitUntil: 'networkidle', timeout: 60000 });
await page.evaluate(async () => {
  await new Promise((res) => { let y=0; const s=()=>{window.scrollBy(0,500);y+=500;if(y<document.body.scrollHeight)setTimeout(s,80);else res();}; s(); });
});
await page.waitForTimeout(1200);
for (const s of sections) {
  await page.screenshot({ path: `/workspace/.codeyam/tmp/${s.name}.png`, fullPage: true, clip: { x:0, y:s.top, width:1280, height:s.height } });
}
console.log('done');
await page.close();
await browser.close();
