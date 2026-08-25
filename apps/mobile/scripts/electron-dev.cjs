const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const METRO_URL = process.env.ELECTRON_START_URL || 'http://localhost:8081';
const METRO_STATUS_URL = new URL('/status', METRO_URL).href;
const root = path.resolve(__dirname, '..');

function isMetroUp() {
  return new Promise((resolve) => {
    const req = http.get(METRO_STATUS_URL, (res) => {
      res.resume();
      resolve((res.statusCode ?? 500) < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForMetro(timeoutMs = 180000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isMetroUp()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Metro did not become ready at ${METRO_URL}`);
}

function startMetro() {
  const child = spawn('npx', ['expo', 'start', '--port', '8081'], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env: {
      ...process.env,
      BROWSER: 'none',
    },
  });

  child.on('exit', (code) => {
    if (code && code !== 0) {
      process.exit(code);
    }
  });

  return child;
}

function startElectron() {
  const electronCli = require('electron');
  const main = path.join(root, 'electron', 'main.cjs');
  const child = spawn(electronCli, [main], {
    cwd: root,
    stdio: 'inherit',
    env: {
      ...process.env,
      ELECTRON_START_URL: METRO_URL,
    },
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });
}

async function main() {
  const alreadyRunning = await isMetroUp();
  if (!alreadyRunning) {
    startMetro();
  }

  await waitForMetro();
  startElectron();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
