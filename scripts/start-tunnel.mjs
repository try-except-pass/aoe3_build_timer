/**
 * `npm start`: runs the Expo dev server behind a Cloudflare quick tunnel, so a phone can load
 * the app from any network (no shared Wi-Fi, router or firewall setup needed).
 *
 *   npm start                 # tunnel + expo start
 *   npm start -- --clear      # extra args are passed to `expo start`
 *   npm run start:lan         # plain `expo start` on the local network
 *
 * Expo Go only opens tunnel URLs when it is signed in to the same Expo account as the CLI
 * (`npx expo login`).
 *
 * cloudflared is downloaded to .tools/ on first run on Windows; on macOS/Linux it must be
 * installed (`brew install cloudflared`).
 */
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = process.env.RCT_METRO_PORT ?? '8081';
const isWin = process.platform === 'win32';

async function getCloudflared() {
  if (!isWin) return 'cloudflared';
  const bin = path.join(root, '.tools', 'cloudflared.exe');
  if (fs.existsSync(bin)) return bin;
  console.log('Downloading cloudflared (first run only)…');
  const res = await fetch('https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe');
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
  fs.mkdirSync(path.dirname(bin), { recursive: true });
  fs.writeFileSync(bin, Buffer.from(await res.arrayBuffer()));
  return bin;
}

/** Starts the tunnel and resolves with its public URL once Cloudflare has a connection. */
function startTunnel(bin) {
  // http2 instead of the default QUIC: QUIC is UDP and is blocked on some networks.
  const proc = spawn(bin, ['tunnel', '--no-autoupdate', '--protocol', 'http2', '--url', `http://localhost:${port}`]);
  return new Promise((resolve, reject) => {
    let url = null;
    let log = '';
    const timer = setTimeout(() => reject(new Error(`Tunnel did not connect in time.\n${log.slice(-2000)}`)), 60_000);
    proc.on('error', (e) =>
      reject(isWin ? e : new Error('cloudflared not found. Install it with `brew install cloudflared`.'))
    );
    proc.on('exit', (code) => reject(new Error(`cloudflared exited (${code}).\n${log.slice(-2000)}`)));
    // cloudflared logs to stderr.
    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      log += text;
      url ??= text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/)?.[0] ?? null;
      if (url && /Registered tunnel connection/.test(log)) {
        clearTimeout(timer);
        resolve({ proc, url });
      }
    });
  });
}

const cloudflared = await getCloudflared();
console.log('Starting tunnel…');
let tunnel;
try {
  tunnel = await startTunnel(cloudflared);
} catch (e) {
  console.error(`\nCould not start the tunnel: ${e.message}\nUse \`npm run start:lan\` to start without it.`);
  process.exit(1);
}
console.log(`Tunnel ready: ${tunnel.url}\n`);

const expoCli = path.join(root, 'node_modules', 'expo', 'bin', 'cli');
const expo = spawn(process.execPath, [expoCli, 'start', '--port', port, ...process.argv.slice(2)], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, EXPO_PACKAGER_PROXY_URL: tunnel.url },
});

const shutdown = () => {
  tunnel.proc.kill();
  expo.kill();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
tunnel.proc.on('exit', () => {
  console.error('\nTunnel closed. Restart with `npm start`.');
  expo.kill();
});
expo.on('exit', (code) => {
  tunnel.proc.kill();
  process.exit(code ?? 0);
});
