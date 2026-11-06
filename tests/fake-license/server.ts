import http from 'node:http'

export type LicenseScenario = 'active' | 'invalid' | 'limit' | 'expired' | 'down' | 'offline'
interface Instance { id: string; name: string; createdAt: number }

export async function startFakeLicense() {
  let scenario: LicenseScenario = 'active'
  let requests: Array<{ path: string; form: Record<string, string>; at: number }> = []
  const instances = new Map<string, Instance>()
  let counter = 0
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    if (url.pathname === '/__control' && req.method === 'POST') {
      let raw = ''
      for await (const chunk of req) raw += chunk
      scenario = (JSON.parse(raw || '{}') as { scenario?: LicenseScenario }).scenario ?? 'active'
      res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); return
    }
    if (url.pathname === '/__reset') { scenario = 'active'; instances.clear(); requests = []; counter = 0; res.writeHead(200); res.end('{"ok":true}'); return }
    if (url.pathname === '/__instances') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify([...instances.values()])); return }
    if (req.method !== 'POST' || !url.pathname.startsWith('/v1/licenses/')) { res.writeHead(404); res.end('{"error":"not_found"}'); return }
    let raw = ''
    for await (const chunk of req) raw += chunk
    const form: Record<string, string> = {}
    for (const [key, value] of new URLSearchParams(raw)) form[key] = value
    requests.push({ path: url.pathname, form, at: Date.now() })
    if (scenario === 'down' || scenario === 'offline') { res.destroy(); return }
    const json = (status: number, body: Record<string, unknown>): void => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)) }
    if (url.pathname === '/v1/licenses/activate') {
      if (!form.license_key || form.license_key === 'bad' || scenario === 'invalid') { json(400, { activated: false, error: 'license_key not found' }); return }
      if (scenario === 'expired') { json(400, { activated: false, error: 'license key expired' }); return }
      if (scenario === 'limit' || instances.size >= 2) { json(400, { activated: false, error: 'license_key has no available activations' }); return }
      counter += 1
      const instance: Instance = { id: `instance-${counter}`, name: form.instance_name ?? 'unknown', createdAt: Date.now() }
      instances.set(instance.id, instance)
      json(200, { activated: true, error: null, license_key: { status: 'active', key: form.license_key }, instance: { id: instance.id, name: instance.name } })
      return
    }
    if (url.pathname === '/v1/licenses/validate') {
      if (scenario === 'invalid' || scenario === 'expired') { json(200, { valid: false, license_key: { status: scenario === 'expired' ? 'expired' : 'inactive' } }); return }
      const instance = form.instance_id ? instances.get(form.instance_id) : undefined
      if (!instance) { json(200, { valid: false, license_key: { status: 'inactive' } }); return }
      json(200, { valid: true, license_key: { status: 'active' }, instance: { id: instance.id } })
      return
    }
    if (url.pathname === '/v1/licenses/deactivate') { if (form.instance_id) instances.delete(form.instance_id); json(200, { deactivated: true }); return }
    json(404, { error: 'not_found' })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Fake License did not bind')
  return {
    port: address.port,
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
    control: (next: LicenseScenario) => { scenario = next },
    requests: () => requests,
    reset: () => { scenario = 'active'; instances.clear(); requests = []; counter = 0 },
    instances: () => [...instances.values()]
  }
}
