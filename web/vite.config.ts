import { defineConfig } from 'vite'
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

export default defineConfig({
  base: './',
  define: { CESIUM_BASE_URL: JSON.stringify(`./${cesiumBaseUrl}`) },
  plugins: [
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
