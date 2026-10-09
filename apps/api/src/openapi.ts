import { ENDPOINTS } from './catalog.js';

/** OpenAPI 3.1 generado a partir del catálogo de endpoints. */
export function openApiDoc(baseUrl: string) {
  const toOpenApiPath = (path: string) => path.replace(/:(\w+)/g, '{$1}');

  const paths: Record<string, Record<string, unknown>> = {};

  for (const endpoint of ENDPOINTS) {
    const method = endpoint.method.toLowerCase();
    const pathItem = (paths[toOpenApiPath(endpoint.path)] ??= {});

    const parameters = endpoint.params
      .filter((p) => p.in === 'query' || p.in === 'path')
      .map((p) => ({
        name: p.name,
        in: p.in,
        required: Boolean(p.required),
        description: p.description + (p.default ? ` (por defecto: ${p.default})` : ''),
        schema: { type: p.type === 'number' ? 'number' : p.type === 'boolean' ? 'boolean' : 'string' },
        ...(p.example ? { example: p.example } : {}),
      }));

    if (endpoint.auth !== 'none') {
      parameters.push({
        name: 'Authorization',
        in: 'header',
        required: true,
        description: 'Bearer bsk_live_... (API key) o el JWT de sesión',
        schema: { type: 'string' },
      });
    }

    const bodyParams = endpoint.params.filter((p) => p.in === 'body');
    const requestBody =
      bodyParams.length > 0
        ? {
            required: bodyParams.some((p) => p.required),
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: Object.fromEntries(
                    bodyParams.map((p) => [
                      p.name,
                      { type: p.type === 'number' ? 'number' : p.type === 'boolean' ? 'boolean' : p.type === 'object' ? 'object' : 'string', description: p.description },
                    ])
                  ),
                },
              },
            },
          }
        : undefined;

    pathItem[method] = {
      tags: [endpoint.tag],
      summary: endpoint.title,
      description: endpoint.description,
      operationId: endpoint.id,
      ...(parameters.length ? { parameters } : {}),
      ...(requestBody ? { requestBody } : {}),
      responses: {
        '200': {
          description: 'OK',
          content: {
            [endpoint.id.startsWith('brat') ? 'image/*' : 'application/json']: {},
          },
        },
        '401': { description: 'No autenticado' },
        '429': { description: 'Límite de peticiones excedido' },
      },
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Brat Sticker API',
      version: '1.0.0',
      description: 'Genera stickers estilo Brat por HTTP. Plantilla full-stack lista para Vercel.',
    },
    servers: [{ url: baseUrl }],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', description: 'API key (bsk_live_...) o JWT de sesión' },
      },
    },
    security: [{ bearerAuth: [] }],
  };
}
