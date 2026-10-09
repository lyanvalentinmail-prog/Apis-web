import { config } from './config.js';
import { createApp } from './app.js';
import { store } from './store.js';

const app = createApp(store);

app.listen(config.port, '0.0.0.0', () => {
  console.log(`\n  🚀 API escuchando en http://localhost:${config.port}`);
  console.log(`     Health:    http://localhost:${config.port}/v1/health`);
  console.log(`     Endpoints: http://localhost:${config.port}/v1/endpoints`);
  console.log(`     Brat:      http://localhost:${config.port}/v1/brat?text=brat&size=512`);
  console.log(`     Store:     ${store.driver}${store.driver === 'file' ? ` (${config.dataDir})` : ''}\n`);
});
