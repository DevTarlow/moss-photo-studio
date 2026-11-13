import http from 'node:http'

export type LicenseScenario = 'active' | 'invalid' | 'limit' | 'expired' | 'down' | 'offline' | 'server-error'
interface Instance { id: string; name: string; createdAt: number }

async function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  let raw = ''
  for await (const chunk of req) raw += chunk
  try {
    const parsed = JSON.parse(raw || '{}')
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

/**
 * A real loopback HTTP fake for the Moss portal license API. The integration,
 * E2E, and controller tests exercise the real provider against this server.
 */
export async function startFakeLicense() {
  let scenario: LicenseScenario = 'active'
  let requests: Array<{ path: string; json: Record<string, unknown>; at: number }> = []
  const instances = new Map<string, Instance>()
  let counter = 0

  const json = (res: http.ServerResponse, status: number, body: Record<string, unknown>): void => {
    res.writeHead(status, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(body))
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    if (url.pathname === '/__control' && req.method === 'POST') {
      const body = await readJson(req)
      scenario = (body.scenario as LicenseScenario) ?? 'active'
      json(res, 200, { ok: true })
      return
    }
    if (url.pathname === '/__reset') {
      scenario = 'active'
      instances.clear()
      requests = []
      counter = 0
      json(res, 200, { ok: true })
      return
    }
    if (url.pathname === '/__instances') {
      json(res, 200, { instances: [...instances.values()] })
      return
    }
    if (req.method !== 'POST' || !url.pathname.startsWith('/api/v1/licenses/')) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end('{"error":"not_found"}')
      return
    }

    const body = await readJson(req)
    requests.push({ path: url.pathname, json: body, at: Date.now() })
    if (scenario === 'down' || scenario === 'offline') {
      res.destroy()
      return
    }
    if (scenario === 'server-error') {
      json(res, 500, { error: 'internal_error' })
      return
    }

    const key = typeof body.key === 'string' ? body.key : ''
    if (url.pathname === '/api/v1/licenses/activate') {
      if (!key || key === 'bad' || scenario === 'invalid') {
        json(res, 400, { error: 'invalid_key' })
        return
      }
      if (scenario === 'expired') {
        json(res, 410, { error: 'license_expired' })
        return
      }
      if (scenario === 'limit' || instances.size >= 2) {
        json(res, 409, { error: 'activation_limit' })
        return
      }
      const name = typeof body.instance_name === 'string' ? body.instance_name : 'unknown'
      const existing = [...instances.values()].find((instance) => instance.name === name)
      if (existing) {
        json(res, 200, {
          activated: true,
          instance: { id: existing.id, name: existing.name },
          license: { status: 'active', expiresAt: null }
        })
        return
      }
      counter += 1
      const instance: Instance = { id: `instance-${counter}`, name, createdAt: Date.now() }
      instances.set(instance.id, instance)
      json(res, 200, {
        activated: true,
        instance: { id: instance.id, name: instance.name },
        license: { status: 'active', expiresAt: null }
      })
      return
    }

    if (url.pathname === '/api/v1/licenses/validate') {
      if (scenario === 'invalid') {
        json(res, 200, { valid: false, license: { status: 'inactive' } })
        return
      }
      if (scenario === 'expired') {
        json(res, 200, { valid: false, license: { status: 'expired' } })
        return
      }
      const instanceId = typeof body.instance_id === 'string' ? body.instance_id : ''
      if (!instanceId || !instances.has(instanceId)) {
        json(res, 200, { valid: false, license: { status: 'inactive' } })
        return
      }
      json(res, 200, { valid: true, license: { status: 'active', expiresAt: null } })
      return
    }

    if (url.pathname === '/api/v1/licenses/deactivate') {
      const instanceId = typeof body.instance_id === 'string' ? body.instance_id : ''
      if (instanceId) instances.delete(instanceId)
      json(res, 200, { deactivated: true })
      return
    }

    json(res, 404, { error: 'not_found' })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Fake License did not bind')
  return {
    port: address.port,
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
    control: (next: LicenseScenario) => {
      scenario = next
    },
    requests: () => requests,
    reset: () => {
      scenario = 'active'
      instances.clear()
      requests = []
      counter = 0
    },
    instances: () => [...instances.values()]
  }
}
