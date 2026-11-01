import { readFileSync } from 'node:fs'
import { type Plugin, defineConfig, loadEnv } from 'vite'
import { viteStaticCopy } from 'vite-plugin-static-copy'

// Cesium ships workers/assets that must be served as static files (official Cesium + Vite recipe).
const cesiumSource = 'node_modules/cesium/Build/Cesium'
const cesiumBaseUrl = 'cesium'

// NASA's raw image files send no CORS headers; proxying them same-origin lets the Street View
// stitcher read their pixels. A static deploy needs the same /nasa-raw rewrite on its host.
const nasaRaw = {
  '/nasa-raw': {
    target: 'https://mars.nasa.gov',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/nasa-raw/, ''),
  },
}

// Ask ATLAS in dev: /api/explain runs the same handler as the Vercel function (api/explain.ts),
// with the key from the shell or web/.env.local (ANTHROPIC_API_KEY; server-side only, no VITE_
// prefix, so it never reaches the browser). Without a key it answers 503, as on Vercel.
function askAtlasApi(): Plugin {
  let handle: ((req: Request) => Promise<Response>) | undefined
  return {
    name: 'ask-atlas-api',
    configureServer(server) {
      server.middlewares.use('/api/explain', (req, res, next) => {
        void (async () => {
          const mod = (await server.ssrLoadModule(
            '/src/server/explain.ts',
          )) as typeof import('./src/server/explain')
          handle ??= mod.explainHandler(
            process.env.ANTHROPIC_API_KEY ??
              loadEnv(server.config.mode, process.cwd(), 'ANTHROPIC_').ANTHROPIC_API_KEY,
            readFileSync('../docs/data-sources.md', 'utf8'),
          )
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const headers = new Headers()
          for (const [k, v] of Object.entries(req.headers))
            if (typeof v === 'string') headers.set(k, v)
          const response = await handle(
            new Request('http://localhost/api/explain', {
              method: req.method,
              headers,
              body: req.method === 'POST' ? Buffer.concat(chunks) : undefined,
            }),
          )
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          if (response.body) for await (const chunk of response.body) res.write(chunk)
          res.end()
        })().catch(next)
      })
    },
  }
}

export default defineConfig({
  base: './',
  define: { CESIUM_BASE_URL: JSON.stringify(`./${cesiumBaseUrl}`) },
  plugins: [
    askAtlasApi(),
    viteStaticCopy({
      targets: ['Workers', 'ThirdParty', 'Assets', 'Widgets'].map((dir) => ({
        src: `${cesiumSource}/${dir}`,
        dest: cesiumBaseUrl,
      })),
    }),
  ],
  server: { proxy: nasaRaw },
  preview: { proxy: nasaRaw },
  test: { environment: 'node' },
})
