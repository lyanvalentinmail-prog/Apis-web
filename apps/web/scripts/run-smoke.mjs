import { createServer } from 'vite';

const vite = await createServer({
  root: process.cwd(),
  logLevel: 'warn',
  server: { middlewareMode: true },
  appType: 'custom',
});

try {
  await vite.ssrLoadModule('/scripts/smoke.tsx');
} catch (err) {
  console.error('smoke failed:', err);
  process.exitCode = 1;
} finally {
  await vite.close();
}
