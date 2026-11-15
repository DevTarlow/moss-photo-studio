import path from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const shared = path.resolve('src/shared')
const renderer = path.resolve('src/renderer/src')

export default defineConfig({
  main: {
    define: {
      __BUILD_DATE__: JSON.stringify(new Date().toISOString()),
      __MOSS_TEST_BUILD__: JSON.stringify(process.env.MOSS_TEST_BUILD === '1')
    },
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': shared, '@main': path.resolve('src/main') } }
  },
  preload: {
    define: { __BUILD_DATE__: JSON.stringify(new Date().toISOString()) },
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': shared } }
  },
  renderer: {
    root: path.resolve('src/renderer'),
    resolve: { alias: { '@shared': shared, '@renderer': renderer } },
    define: { __BUILD_DATE__: JSON.stringify(new Date().toISOString()) },
    plugins: [react(), tailwindcss()],
    server: {
      fs: { allow: [path.resolve('.')] }
    },
    build: {
      rollupOptions: {
        input: path.resolve('src/renderer/index.html')
      }
    }
  }
})
