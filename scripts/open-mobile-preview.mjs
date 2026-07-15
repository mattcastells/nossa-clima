// Abre la app web en una ventana del tamaño de un teléfono, sin barra de
// direcciones ni devtools, para revisar el diseño mobile sin emulador.
//
//   npm run web           (en otra terminal, deja el server corriendo)
//   npm run web:mobile
//
// Opcional: npm run web:mobile -- --port 8083 --size 430x932
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const readFlag = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index !== -1 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
};

const port = readFlag('port', process.env.PORT ?? '8081');
const size = readFlag('size', '390x844'); // iPhone 14
const url = readFlag('url', `http://localhost:${port}`);

const [width, height] = size.split('x');
if (!width || !height || Number.isNaN(Number(width)) || Number.isNaN(Number(height))) {
  console.error(`Tamaño inválido: "${size}". Usá ancho x alto, por ejemplo 390x844.`);
  process.exit(1);
}

// Perfil aparte: así la ventana no hereda extensiones ni pestañas del Chrome normal.
const userDataDir = path.join(os.tmpdir(), 'nossa-clima-mobile-preview');

const CANDIDATES = {
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ],
  linux: ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'],
};

const browser = (CANDIDATES[os.platform()] ?? []).find((candidate) => fs.existsSync(candidate));

if (!browser) {
  console.error('No encontre Chrome ni Edge instalado.');
  console.error(`Abri manualmente ${url} y achica la ventana a ${size}.`);
  process.exit(1);
}

const child = spawn(
  browser,
  [
    `--app=${url}`,
    `--window-size=${width},${height}`,
    '--window-position=60,40',
    `--user-data-dir=${userDataDir}`,
  ],
  { detached: true, stdio: 'ignore' },
);
child.unref();

console.log(`Vista mobile ${size} abierta en ${url}`);
console.log('Si la ventana queda en blanco, revisa que el server este levantado (npm run web).');
