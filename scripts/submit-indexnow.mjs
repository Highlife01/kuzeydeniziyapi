import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CATALOG_PATH = path.join(ROOT_DIR, 'src', 'seo', 'seoCatalog.json');

const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const { routes } = catalog;

const HOST = 'www.kuzeydenizi.com.tr';
const BASE_URL = `https://${HOST}`;
const KEY = 'cb84f1d92e5a4b7c8f103d2e6a9c4b71';
const KEY_LOCATION = `${BASE_URL}/${KEY}.txt`;

const urlList = routes.map((r) => `${BASE_URL}${r.path === '/' ? '/' : r.path}`);

const payload = {
  host: HOST,
  key: KEY,
  keyLocation: KEY_LOCATION,
  urlList,
};

async function submitIndexNowEndpoint(endpointUrl, name) {
  try {
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text().catch(() => '');
    console.log(
      `[IndexNow] ${name} (${endpointUrl}) -> HTTP ${res.status} ${res.statusText}${
        text ? ` | ${text.slice(0, 160)}` : ''
      }`
    );
    return res.status;
  } catch (err) {
    console.warn(`[IndexNow] ${name} gönderim uyarısı:`, err.message);
    return null;
  }
}

async function main() {
  console.log(`[IndexNow] ${HOST} için anlık indeksleme bildirimi başlatılıyor...`);
  urlList.forEach((u) => console.log(`  - ${u}`));

  await submitIndexNowEndpoint('https://api.indexnow.org/indexnow', 'IndexNow Central');
  await submitIndexNowEndpoint('https://www.bing.com/indexnow', 'Bing IndexNow');
  await submitIndexNowEndpoint('https://yandex.com/indexnow', 'Yandex IndexNow');
}

main();
