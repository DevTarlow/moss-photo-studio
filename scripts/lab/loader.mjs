import path from 'node:path'
import { createServer } from 'vite'

/**
 * Loads the app's TypeScript prompt modules and Muse client inside the lab.
 * Vite is already a dev dependency, so the harness reuses the shipping code
 * instead of copying any prompt strings or request logic.
 */
export async function createLabLoader(root = process.cwd()) {
  const server = await createServer({
    configFile: false,
    root,
    logLevel: 'error',
    appType: 'custom',
    resolve: {
      alias: {
        '@shared': path.join(root, 'src/shared'),
        '@main': path.join(root, 'src/main')
      }
    },
    server: { middlewareMode: true, hmr: false, watch: null },
    optimizeDeps: { noDiscovery: true }
  })
  return {
    load: (id) => server.ssrLoadModule(id),
    close: () => server.close()
  }
}
