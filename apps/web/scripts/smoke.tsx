const store = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
};
(globalThis as any).fetch = async () => ({
  ok: true, status: 200, statusText: 'OK',
  headers: new Map([['content-type', 'application/json']]),
  json: async () => ({ data: [] }), text: async () => '{}', blob: async () => new Blob(),
});

const { renderToString } = await import('react-dom/server');
const { MemoryRouter, Routes, Route } = await import('react-router-dom');
const React = (await import('react')).default;
const { AuthProvider } = await import('../src/lib/auth.tsx');
const { Layout } = await import('../src/components/Layout.tsx');

const pages: [string, any][] = [
  ['Home', (await import('../src/pages/Home.tsx')).default],
  ['Docs', (await import('../src/pages/Docs.tsx')).default],
  ['Endpoints', (await import('../src/pages/Endpoints.tsx')).default],
  ['Login', (await import('../src/pages/Login.tsx')).default],
  ['Register', (await import('../src/pages/Register.tsx')).default],
  ['Dashboard', (await import('../src/pages/Dashboard.tsx')).default],
  ['NotFound', (await import('../src/pages/NotFound.tsx')).default],
];

let failed = 0;
for (const [name, Page] of pages) {
  try {
    const html = renderToString(
      React.createElement(MemoryRouter, { initialEntries: ['/'] },
        React.createElement(AuthProvider, null,
          React.createElement(Routes, null,
            React.createElement(Route, { element: React.createElement(Layout) },
              React.createElement(Route, { path: '/', element: React.createElement(Page) })
            )
          )
        ))
    );
    console.log(`OK ${name} (${html.length} bytes)`);
  } catch (err) {
    failed++;
    console.error(`FAIL ${name}: ${(err as Error).message}`);
  }
}
process.exit(failed ? 1 : 0);
