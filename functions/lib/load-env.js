const fs = require('fs');
const path = require('path');

function applyFile(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  }
}

function loadEnv() {
  const root = path.join(__dirname, '..', '..');
  // .env.local holds local-only secrets (e.g. NATRO_MAIL_01_PASS) and is never
  // deployed; production passwords live in Secret Manager.
  if (!process.env.K_SERVICE) applyFile(path.join(__dirname, '..', '.env.local'));
  applyFile(path.join(__dirname, '..', '.env'));
  applyFile(path.join(root, '.env'));
}

module.exports = { loadEnv };
