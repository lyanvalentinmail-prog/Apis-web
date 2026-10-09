/**
 * Entrada serverless para Vercel.
 * Vercel convierte este archivo en una función (ruta /api/index) y el
 * vercel.json reescribe todas las peticiones hacia aquí, manteniendo la
 * ruta original para que Express enrute igual que en local.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../src/app.js';
import { store } from '../src/store.js';

const app = createApp(store);

export default function handler(req: IncomingMessage, res: ServerResponse) {
  // Si la reescritura deja el prefijo de la función, se limpia para Express.
  if (typeof req.url === 'string' && req.url.startsWith('/api/index')) {
    req.url = req.url.replace(/^\/api\/index/, '') || '/';
  }
  return app(req as never, res as never);
}
