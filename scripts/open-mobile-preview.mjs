// Levanta la app web y la abre en una ventana del tamaño de un teléfono, sin
// barra de direcciones ni devtools, para revisar el diseño mobile sin emulador.
//
//   npm run web:mobile
//
// Si el puerto ya tiene un server escuchando, no levanta otro: solo abre la
// ventana contra el que esté corriendo.
//
// Opciones: npm run web:mobile -- --port 8083 --size 430x932
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

// Perfil aparte: así la ventana no hereda extensiones ni pestañas del navegador normal.
const userDataDir = path.join(os.tmpdir(), 'nossa-clima-mobile-preview');

// --fresh borra el perfil. Es la salida cuando la ventana quedó con un bundle
// viejo cacheado y reporta "Requiring unknown module".
if (process.argv.includes('--fresh') && fs.existsSync(userDataDir)) {
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
    console.log('Perfil del navegador borrado: la ventana arranca sin cache.');
  } catch {
    // El perfil está tomado mientras la ventana siga abierta.
    console.error('No pude borrar el perfil: cerra la ventana de preview y volve a correr el comando.');
    process.exit(1);
  }
}

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

const findBrowser = () => (CANDIDATES[os.platform()] ?? []).find((candidate) => fs.existsSync(candidate));

const isServerUp = async () => {
  try {
    await fetch(url, { signal: AbortSignal.timeout(1500) });
    return true;
  } catch {
    return false;
  }
};

const waitForServer = async (timeoutMs = 180000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isServerUp()) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return false;
};

const openWindow = (browser) => {
  const child = spawn(
    browser,
    [`--app=${url}`, `--window-size=${width},${height}`, '--window-position=60,40', `--user-data-dir=${userDataDir}`],
    { detached: true, stdio: 'ignore' },
  );
  child.unref();
};

const main = async () => {
  const browser = findBrowser();
  if (!browser) {
    console.error('No encontre Chrome ni Edge instalado.');
    console.error(`Abri manualmente ${url} y achica la ventana a ${size}.`);
    process.exit(1);
  }

  if (await isServerUp()) {
    console.log(`Ya hay un server en ${url}: abro la ventana contra ese.`);
    openWindow(browser);
    return;
  }

  // --clear reinicia Metro con la cache limpia. Sirve cuando el navegador
  // reporta "Requiring unknown module": el bundle abierto quedo desincronizado
  // con el server y los ids de modulo ya no coinciden.
  const clearCache = process.argv.includes('--clear');
  const expoArgs = ['expo', 'start', '--web', '--port', port, ...(clearCache ? ['--clear'] : [])];

  console.log(`Levantando Expo web en el puerto ${port}${clearCache ? ' (cache limpia)' : ''}...`);
  const expo = spawn('npx', expoArgs, {
    stdio: 'inherit',
    shell: os.platform() === 'win32', // en Windows npx es un .cmd
    // Sin chunks lazy en dev: evita "Requiring unknown module" cuando la
    // ventana y el server quedan desincronizados.
    env: { ...process.env, EXPO_NO_METRO_LAZY: '1' },
  });

  const shutdown = () => {
    if (!expo.killed) expo.kill();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  expo.on('exit', (code) => process.exit(code ?? 0));

  if (!(await waitForServer())) {
    console.error('El server no respondio a tiempo. Cancelo.');
    shutdown();
    return;
  }

  openWindow(browser);
  console.log(`\nVista mobile ${size} abierta en ${url}. Ctrl+C para cortar el server.`);
};

void main();
