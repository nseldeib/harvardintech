import fs from 'fs';
import { execSync } from 'child_process';

const extract = JSON.parse(fs.readFileSync('/workspace/.codeyam/tmp/extract.json', 'utf8'));

// Gallery: bump to retina + decent quality
const gallery = extract.gallery.map((u) =>
  u.replace('h_200,w_200', 'h_400,w_400').replace(',q_1/', ',q_auto/').replace('q_80', 'q_auto'),
);

const dir = '/workspace/public/images/gallery';
// wipe old 12
for (const f of fs.readdirSync(dir)) fs.rmSync(`${dir}/${f}`);

let i = 0;
for (const url of gallery) {
  i++;
  const name = `event-${String(i).padStart(2, '0')}.jpg`;
  execSync(`curl -sL --max-time 30 -o "${dir}/${name}" "${url}"`);
}
console.log('gallery downloaded:', i);

// WhatsApp banner (bigger)
execSync(`curl -sL --max-time 30 -o "/workspace/public/images/sections/whatsapp-banner.jpg" "https://custom-images.strikinglycdn.com/res/hrscywv4p/image/upload/c_limit,fl_lossy,h_9000,w_1200,f_auto,q_auto/13213024/20390"`);
console.log('whatsapp banner downloaded');

// Support icons
const icons = { trophy: '64', chat: '03', briefcase: '04', quote: '07', star: '74' };
fs.mkdirSync('/workspace/public/images/support', { recursive: true });
for (const [name, id] of Object.entries(icons)) {
  execSync(`curl -sL --max-time 30 -o "/workspace/public/images/support/${name}.png" "https://assets.strikingly.com/static/icons/flat-circle-160/${id}.png"`);
}
console.log('support icons downloaded');
