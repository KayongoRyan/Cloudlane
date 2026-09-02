import { getApiBase } from './api'
import { consoleApiGet, consoleApiSend } from './consoleApi'

export type TerminalLineType = 'in' | 'out' | 'err' | 'sys' | 'ok'

export interface TerminalLine {
  type: TerminalLineType
  text: string
}

export interface TerminalContext {
  projectId?: string
  projectName?: string
}

export const COMMAND_HINTS = [
  'help',
  'status',
  'quota',
  'monitor',
  'projects list',
  'deployments list',
  'deploy create --name api --image nginx:alpine --port 80',
  'deploy delete <name>',
  'logs <name>',
  'db list',
  'db create --name app-db',
  'db backup <name>',
  'lb list',
  'lb create --name edge --protocol HTTP --port 80',
  'gateway list',
  'gateway create --name public-api',
  'secret list',
  'bucket list',
  'bucket create --name uploads',
  'vm list',
  'billing usage',
  'audit list',
  'graphql { deployments { name status } }',
  'clear',
  'exit',
]

export const QUICK_COMMANDS: { group: string; cmd: string }[] = [
  { group: 'Core', cmd: 'status' },
  { group: 'Core', cmd: 'quota' },
  { group: 'Core', cmd: 'monitor' },
  { group: 'Deploy', cmd: 'deployments list' },
  { group: 'Deploy', cmd: 'deploy create --name api --image nginx:alpine --port 80' },
  { group: 'Data', cmd: 'db list' },
  { group: 'Data', cmd: 'bucket list' },
  { group: 'Edge', cmd: 'gateway list' },
  { group: 'Edge', cmd: 'lb list' },
  { group: 'Security', cmd: 'secret list' },
  { group: 'Billing', cmd: 'billing usage' },
  { group: 'API', cmd: 'graphql { deployments { name status } }' },
]

const HELP = `Cloudlane Terminal — control plane CLI (browser session)

Core
  help [cmd]          Command reference
  status              API + project health
  quota               Tenant limits and usage
  monitor             Deployment health + usage metrics
  clear               Clear screen
  exit                Close terminal

Projects
  projects list

Deployments
  deployments list
  deploy create --name N --image IMG --port P [--min 0] [--max 3]
  deploy delete <name|id>
  logs <name> [--tail 100]

Databases (Cloud SQL)
  db list
  db create --name N [--engine postgres|mysql] [--size 10] [--dedicated]
  db delete <name|id>
  db backup <name|id>
  db reveal <name|id>

Load balancers
  lb list
  lb create --name N [--protocol HTTP|HTTPS|TCP] [--port 80]
  lb delete <name|id>

API Gateway
  gateway list
  gateway create --name N

Secrets
  secret list
  secret create --name N --value V
  secret delete <name|id>

Object storage
  bucket list
  bucket create --name N
  bucket objects <name>

Compute VMs
  vm list
  vm create --name N [--cpu 1] [--memory 512]
  vm start|stop <name|id>

Billing
  billing usage
  billing invoices

Audit
  audit list [--limit 20]

GraphQL
  graphql <query>     POST read/mutation query (JSON body auto-wrapped)`

function parseFlags(args: string[]): { flags: Record<string, string>; positional: string[] } {
  const flags: Record<string, string> = {}
  const positional: string[] = []
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i]
    if (a.startsWith('--')) {
      const key = a.slice(2)
      const next = args[i + 1]
      if (next && !next.startsWith('--')) {
        flags[key] = next
        i += 1
      } else {
        flags[key] = 'true'
      }
    } else {
      positional.push(a)
    }
  }
  return { flags, positional }
}

function projectQuery(ctx: TerminalContext): string {
  return ctx.projectId ? `?projectId=${ctx.projectId}` : ''
}

async function findDeployment(nameOrId: string, ctx: TerminalContext) {
  const data = await consoleApiGet<{ deployments: { id: string; name: string }[] }>(
    `/api/deployments${projectQuery(ctx)}`,
  )
  const hit = data.deployments.find((d) => d.id === nameOrId || d.name === nameOrId)
  if (!hit) throw new Error(`Deployment not found: ${nameOrId}`)
  return hit
}

async function findDatabase(nameOrId: string, ctx: TerminalContext) {
  const data = await consoleApiGet<{ instances: { id: string; name: string }[] }>(
    `/api/databases${projectQuery(ctx)}`,
  )
  const hit = data.instances.find((d) => d.id === nameOrId || d.name === nameOrId)
  if (!hit) throw new Error(`Database instance not found: ${nameOrId}`)
  return hit
}

async function findLoadBalancer(nameOrId: string, ctx: TerminalContext) {
  const data = await consoleApiGet<{ loadBalancers: { id: string; name: string }[] }>(
    `/api/load-balancers${projectQuery(ctx)}`,
  )
  const hit = data.loadBalancers.find((lb) => lb.id === nameOrId || lb.name === nameOrId)
  if (!hit) throw new Error(`Load balancer not found: ${nameOrId}`)
  return hit
}

async function findSecret(nameOrId: string, ctx: TerminalContext) {
  const data = await consoleApiGet<{ secrets: { id: string; name: string }[] }>(
    `/api/secrets${projectQuery(ctx)}`,
  )
  const hit = data.secrets.find((s) => s.id === nameOrId || s.name === nameOrId)
  if (!hit) throw new Error(`Secret not found: ${nameOrId}`)
  return hit
}

async function findVm(nameOrId: string, ctx: TerminalContext) {
  const data = await consoleApiGet<{ vms: { id: string; name: string }[] }>(
    `/api/vms${projectQuery(ctx)}`,
  )
  const hit = data.vms.find((v) => v.id === nameOrId || v.name === nameOrId)
  if (!hit) throw new Error(`VM not found: ${nameOrId}`)
  return hit
}

function table(rows: string[][]): string {
  if (!rows.length) return '(empty)'
  const widths = rows[0].map((_, col) => Math.max(...rows.map((r) => (r[col] ?? '').length)))
  return rows
    .map((row) => row.map((cell, i) => (cell ?? '').padEnd(widths[i])).join('  '))
    .join('\n')
}

export async function runTerminalCommand(
  raw: string,
  ctx: TerminalContext,
): Promise<TerminalLine[]> {
  const cmd = raw.trim()
  if (!cmd) return []

  const lines: TerminalLine[] = [{ type: 'in', text: `$ ${cmd}` }]
  const parts = cmd.split(/\s+/)
  const [root, sub, ...rest] = parts
  const rootLower = root.toLowerCase()

  try {
    if (rootLower === 'help') {
      const topic = sub?.toLowerCase()
      if (!topic) {
        lines.push({ type: 'out', text: HELP })
      } else {
        const section = HELP.split('\n\n').find((block) => block.toLowerCase().includes(topic))
        lines.push({ type: 'out', text: section ?? `No help for "${topic}". Type "help" for full list.` })
      }
      return lines
    }

    if (rootLower === 'status') {
      const base = getApiBase()
      let healthPayload: Record<string, unknown> | null = null
      let healthOk = false
      try {
        const hr = await fetch(`${base}/health`)
        healthOk = hr.ok
        healthPayload = hr.ok ? await hr.json().catch(() => ({})) : null
      } catch {
        healthOk = false
      }

      const hasToken = Boolean(localStorage.getItem('token'))
      let authLine = 'not signed in'
      let authOk = false
      if (hasToken) {
        try {
          await consoleApiGet<{ projects: unknown[] }>('/api/projects')
          authOk = true
          authLine = 'Bearer token valid'
        } catch (err: unknown) {
          authLine = err instanceof Error ? `token rejected — ${err.message}` : 'token rejected'
        }
      }

      // Python health includes `encryption`; Node (Express) does not.
      const flavor =
        healthPayload && 'encryption' in healthPayload
          ? 'python (full control plane)'
          : healthPayload && 'hasDatabaseUrl' in healthPayload
            ? 'node (legacy — no db/gateway/lb/sql routes)'
            : healthOk
              ? 'unknown'
              : 'unreachable'

      const projectLine = ctx.projectId
        ? `${ctx.projectName ?? '—'} (${ctx.projectId})`
        : 'none selected — pick a project in the top bar (or create one)'

      lines.push({
        type: healthOk && authOk ? 'ok' : 'err',
        text: [
          `API          ${base} ${healthOk ? '● online' : '○ unreachable'}`,
          `Backend      ${flavor}`,
          `Project      ${projectLine}`,
          `Auth         ${authLine}`,
          `Shell        Cloudlane Terminal v1 (browser)`,
          !authOk && hasToken
            ? `Hint         Re-login so JWT matches this API host.`
            : '',
          flavor.startsWith('node')
            ? `Hint         Point NEXT_PUBLIC_API_URL at http://localhost:8001 (Python) for db/gateway/lb.`
            : '',
        ]
          .filter(Boolean)
          .join('\n'),
      })
      return lines
    }

    if (rootLower === 'quota') {
      const q = await consoleApiGet<{
        limits: Record<string, number>
        usage: Record<string, number>
        available: Record<string, number>
      }>('/api/quota')
      const rows = [['Resource', 'Used', 'Limit', 'Available']]
      const pairs: [string, string, string][] = [
        ['Deployments', 'deployments', 'maxDeployments'],
        ['CPU (vCPU)', 'totalCpu', 'maxCpu'],
        ['Memory MB', 'totalMemoryMb', 'maxMemoryMb'],
        ['Buckets', 'buckets', 'maxBuckets'],
        ['Secrets', 'secrets', 'maxSecrets'],
        ['Load balancers', 'loadBalancers', 'maxLoadBalancers'],
        ['DB instances', 'databaseInstances', 'maxDatabaseInstances'],
        ['DB storage GB', 'databaseStorageGb', 'maxDatabaseStorageGb'],
      ]
      for (const [label, useKey, limKey] of pairs) {
        rows.push([
          label,
          String(q.usage[useKey] ?? 0),
          String(q.limits[limKey] ?? '—'),
          String(q.available[useKey] ?? '—'),
        ])
      }
      lines.push({ type: 'out', text: table(rows) })
      return lines
    }

    if (rootLower === 'monitor' || rootLower === 'monitoring') {
      const data = await consoleApiGet<{
        deployments: { total: number; running: number; failed: number }
        metricsByType: Record<string, number>
      }>('/api/monitoring/summary')
      const d = data.deployments
      const metricLines = Object.entries(data.metricsByType)
        .map(([k, v]) => `  ${k.padEnd(16)} ${v}`)
        .join('\n')
      lines.push({
        type: 'out',
        text: [
          `Deployments  ${d.running}/${d.total} running · ${d.failed} failed`,
          metricLines ? `Metrics:\n${metricLines}` : 'Metrics: (none yet)',
        ].join('\n'),
      })
      return lines
    }

    if (rootLower === 'projects') {
      if ((sub ?? 'list').toLowerCase() === 'list') {
        const data = await consoleApiGet<{ projects: { id: string; name: string; slug: string }[] }>('/api/projects')
        lines.push({
          type: 'out',
          text: data.projects.length
            ? table([['NAME', 'SLUG', 'ID'], ...data.projects.map((p) => [p.name, p.slug, p.id])])
            : 'No projects.',
        })
      } else {
        lines.push({ type: 'err', text: 'Usage: projects list' })
      }
      return lines
    }

    if (rootLower === 'deployments' || (rootLower === 'deploy' && sub === 'list')) {
      const data = await consoleApiGet<{
        deployments: {
          id: string
          name: string
          image: string
          status: string
          publicUrl?: string
          port: number
        }[]
      }>(`/api/deployments${projectQuery(ctx)}`)
      lines.push({
        type: 'out',
        text: data.deployments.length
          ? table([
              ['NAME', 'STATUS', 'PORT', 'URL'],
              ...data.deployments.map((d) => [
                d.name,
                d.status,
                String(d.port),
                (d.publicUrl ?? d.image).replace('https://', ''),
              ]),
            ])
          : 'No deployments in this project.',
      })
      return lines
    }

    if (rootLower === 'deploy') {
      const action = (sub ?? '').toLowerCase()
      if (action === 'create') {
        const { flags } = parseFlags(rest)
        const name = flags.name
        const image = flags.image
        const port = parseInt(flags.port ?? '8080', 10)
        if (!name || !image) throw new Error('Usage: deploy create --name N --image IMG --port P')
        const res = await consoleApiSend<{ deployment: { id: string; name: string }; jobId: string }>(
          `/api/deployments${projectQuery(ctx)}`,
          'POST',
          {
            name,
            image,
            port,
            minInstances: parseInt(flags.min ?? '0', 10),
            maxInstances: parseInt(flags.max ?? '3', 10),
          },
        )
        lines.push({
          type: 'ok',
          text: `Queued ${res?.deployment.name} (job ${res?.jobId}) — status: provisioning`,
        })
        return lines
      }
      if (action === 'delete') {
        const target = rest[0]
        if (!target) throw new Error('Usage: deploy delete <name|id>')
        const dep = await findDeployment(target, ctx)
        await consoleApiSend(`/api/deployments/${dep.id}`, 'DELETE')
        lines.push({ type: 'ok', text: `Deleted deployment ${dep.name}` })
        return lines
      }
      throw new Error('Usage: deploy create|delete|list (or: deployments list)')
    }

    if (rootLower === 'logs') {
      const name = sub
      if (!name) throw new Error('Usage: logs <deployment-name> [--tail N]')
      const { flags } = parseFlags(rest)
      const tail = parseInt(flags.tail ?? '100', 10)
      const dep = await findDeployment(name, ctx)
      const data = await consoleApiGet<{ logs: string }>(
        `/api/deployments/${dep.name}/logs?tail=${tail}`,
      )
      lines.push({ type: 'out', text: data.logs || '(no logs)' })
      return lines
    }

    if (rootLower === 'db') {
      const action = (sub ?? 'list').toLowerCase()
      if (action === 'list') {
        const data = await consoleApiGet<{
          instances: {
            name: string
            engine: string
            status: string
            endpoint?: string
            diskUsedMb?: number
            sizeGb: number
            dedicated?: boolean
          }[]
        }>(`/api/databases${projectQuery(ctx)}`)
        lines.push({
          type: 'out',
          text: data.instances.length
            ? table([
                ['NAME', 'ENGINE', 'STATUS', 'DISK', 'ENDPOINT'],
                ...data.instances.map((d) => [
                  d.name,
                  d.engine,
                  d.status,
                  d.diskUsedMb != null ? `${d.diskUsedMb}MB/${d.sizeGb}GB` : `—/${d.sizeGb}GB`,
                  d.endpoint ?? '—',
                ]),
              ])
            : 'No database instances.',
        })
        return lines
      }
      if (action === 'create') {
        const { flags } = parseFlags(rest)
        const name = flags.name
        if (!name) throw new Error('Usage: db create --name N [--engine postgres|mysql] [--size 10] [--dedicated]')
        const res = await consoleApiSend<{ instance: { name: string; endpoint?: string } }>(
          '/api/databases',
          'POST',
          {
            name,
            engine: flags.engine ?? 'postgres',
            sizeGb: parseInt(flags.size ?? '10', 10),
            dedicated: flags.dedicated === 'true',
            projectId: ctx.projectId,
          },
        )
        lines.push({ type: 'ok', text: `Created ${res?.instance.name} @ ${res?.instance.endpoint ?? 'provisioning'}` })
        return lines
      }
      if (action === 'delete') {
        const target = rest[0]
        if (!target) throw new Error('Usage: db delete <name|id>')
        const inst = await findDatabase(target, ctx)
        await consoleApiSend(`/api/databases/${inst.id}`, 'DELETE')
        lines.push({ type: 'ok', text: `Deleted database ${inst.name}` })
        return lines
      }
      if (action === 'backup') {
        const target = rest[0]
        if (!target) throw new Error('Usage: db backup <name|id>')
        const inst = await findDatabase(target, ctx)
        const res = await consoleApiSend<{ backup: { id: string; sizeBytes: number; downloadUrl?: string } }>(
          `/api/databases/${inst.id}/backups`,
          'POST',
        )
        const b = res?.backup
        lines.push({
          type: 'ok',
          text: `Backup ${b?.id} (${b?.sizeBytes ?? 0} bytes)${b?.downloadUrl ? `\n${b.downloadUrl}` : ''}`,
        })
        return lines
      }
      if (action === 'reveal') {
        const target = rest[0]
        if (!target) throw new Error('Usage: db reveal <name|id>')
        const inst = await findDatabase(target, ctx)
        const res = await consoleApiGet<{ instance: { connectionString?: string } }>(
          `/api/databases/${inst.id}?reveal=true`,
        )
        lines.push({ type: 'out', text: res.instance.connectionString ?? '(no connection string)' })
        return lines
      }
      throw new Error('Usage: db list|create|delete|backup|reveal')
    }

    if (rootLower === 'lb') {
      const action = (sub ?? 'list').toLowerCase()
      if (action === 'list') {
        const data = await consoleApiGet<{
          loadBalancers: { name: string; protocol: string; port: number; dnsName?: string; status: string }[]
        }>(`/api/load-balancers${projectQuery(ctx)}`)
        lines.push({
          type: 'out',
          text: data.loadBalancers.length
            ? table([
                ['NAME', 'PROTO', 'PORT', 'DNS', 'STATUS'],
                ...data.loadBalancers.map((lb) => [
                  lb.name,
                  lb.protocol,
                  String(lb.port),
                  lb.dnsName ?? '—',
                  lb.status,
                ]),
              ])
            : 'No load balancers.',
        })
        return lines
      }
      if (action === 'create') {
        const { flags } = parseFlags(rest)
        const name = flags.name
        if (!name) throw new Error('Usage: lb create --name N [--protocol HTTP] [--port 80]')
        const res = await consoleApiSend<{ loadBalancer: { name: string; dnsName?: string } }>(
          '/api/load-balancers',
          'POST',
          {
            name,
            protocol: flags.protocol ?? 'HTTP',
            port: parseInt(flags.port ?? '80', 10),
            projectId: ctx.projectId,
          },
        )
        lines.push({ type: 'ok', text: `LB ${res?.loadBalancer.name} → ${res?.loadBalancer.dnsName}` })
        return lines
      }
      if (action === 'delete') {
        const target = rest[0]
        if (!target) throw new Error('Usage: lb delete <name|id>')
        const lb = await findLoadBalancer(target, ctx)
        await consoleApiSend(`/api/load-balancers/${lb.id}`, 'DELETE')
        lines.push({ type: 'ok', text: `Deleted load balancer ${lb.name}` })
        return lines
      }
      throw new Error('Usage: lb list|create|delete')
    }

    if (rootLower === 'gateway' || rootLower === 'gw') {
      const action = (sub ?? 'list').toLowerCase()
      if (action === 'list') {
        const data = await consoleApiGet<{
          gateways: { name: string; status: string; hostnames: string[]; routeCount?: number }[]
        }>(`/api/gateways${projectQuery(ctx)}`)
        lines.push({
          type: 'out',
          text: data.gateways.length
            ? table([
                ['NAME', 'HOST', 'ROUTES', 'STATUS'],
                ...data.gateways.map((g) => [
                  g.name,
                  g.hostnames[0] ?? '—',
                  String(g.routeCount ?? 0),
                  g.status,
                ]),
              ])
            : 'No gateways.',
        })
        return lines
      }
      if (action === 'create') {
        const { flags } = parseFlags(rest)
        const name = flags.name
        if (!name) throw new Error('Usage: gateway create --name N')
        const res = await consoleApiSend<{ gateway: { name: string; hostnames: string[] } }>(
          '/api/gateways',
          'POST',
          { name, projectId: ctx.projectId },
        )
        lines.push({
          type: 'ok',
          text: `Gateway ${res?.gateway.name} @ ${res?.gateway.hostnames[0] ?? 'provisioning'}`,
        })
        return lines
      }
      throw new Error('Usage: gateway list|create')
    }

    if (rootLower === 'secret') {
      const action = (sub ?? 'list').toLowerCase()
      if (action === 'list') {
        const data = await consoleApiGet<{ secrets: { name: string; version: number }[] }>(
          `/api/secrets${projectQuery(ctx)}`,
        )
        lines.push({
          type: 'out',
          text: data.secrets.length
            ? table([['NAME', 'VERSION'], ...data.secrets.map((s) => [s.name, String(s.version)])])
            : 'No secrets.',
        })
        return lines
      }
      if (action === 'create') {
        const { flags } = parseFlags(rest)
        if (!flags.name || !flags.value) throw new Error('Usage: secret create --name N --value V')
        await consoleApiSend('/api/secrets', 'POST', {
          name: flags.name,
          value: flags.value,
          projectId: ctx.projectId,
        })
        lines.push({ type: 'ok', text: `Secret ${flags.name} created` })
        return lines
      }
      if (action === 'delete') {
        const target = rest[0]
        if (!target) throw new Error('Usage: secret delete <name|id>')
        const sec = await findSecret(target, ctx)
        await consoleApiSend(`/api/secrets/${sec.id}`, 'DELETE')
        lines.push({ type: 'ok', text: `Deleted secret ${sec.name}` })
        return lines
      }
      throw new Error('Usage: secret list|create|delete')
    }

    if (rootLower === 'bucket') {
      const action = (sub ?? 'list').toLowerCase()
      if (action === 'list') {
        const data = await consoleApiGet<{ buckets: { name: string }[] }>(`/api/buckets${projectQuery(ctx)}`)
        lines.push({
          type: 'out',
          text: data.buckets.length
            ? data.buckets.map((b) => b.name).join('\n')
            : 'No buckets.',
        })
        return lines
      }
      if (action === 'create') {
        const { flags } = parseFlags(rest)
        const name = flags.name
        if (!name) throw new Error('Usage: bucket create --name N')
        const res = await consoleApiSend<{ bucket: { name: string } }>(
          '/api/buckets',
          'POST',
          { name, projectId: ctx.projectId },
        )
        lines.push({ type: 'ok', text: `Bucket ${res?.bucket.name} created` })
        return lines
      }
      if (action === 'objects') {
        const bucket = rest[0]
        if (!bucket) throw new Error('Usage: bucket objects <name>')
        const data = await consoleApiGet<{ objects: string[] }>(`/api/buckets/${bucket}/objects`)
        lines.push({
          type: 'out',
          text: data.objects.length ? data.objects.join('\n') : `(bucket ${bucket} is empty)`,
        })
        return lines
      }
      throw new Error('Usage: bucket list|create|objects <name>')
    }

    if (rootLower === 'vm' || rootLower === 'vms') {
      const action = (sub ?? 'list').toLowerCase()
      if (action === 'list') {
        const data = await consoleApiGet<{
          vms: { name: string; cpu: number; memoryMb: number; status: string; publicIp?: string }[]
        }>(`/api/vms${projectQuery(ctx)}`)
        lines.push({
          type: 'out',
          text: data.vms.length
            ? table([
                ['NAME', 'CPU', 'MEM', 'IP', 'STATUS'],
                ...data.vms.map((v) => [
                  v.name,
                  String(v.cpu),
                  `${v.memoryMb}MB`,
                  v.publicIp ?? '—',
                  v.status,
                ]),
              ])
            : 'No VMs in this project.',
        })
        return lines
      }
      if (action === 'create') {
        const { flags } = parseFlags(rest)
        const name = flags.name
        if (!name) throw new Error('Usage: vm create --name N [--cpu 1] [--memory 512]')
        const res = await consoleApiSend<{ vm: { name: string; status: string } }>(
          '/api/vms',
          'POST',
          {
            name,
            cpu: parseInt(flags.cpu ?? '1', 10),
            memoryMb: parseInt(flags.memory ?? '512', 10),
            projectId: ctx.projectId,
          },
        )
        lines.push({ type: 'ok', text: `VM ${res?.vm.name} (${res?.vm.status})` })
        return lines
      }
      if (action === 'start' || action === 'stop') {
        const target = rest[0]
        if (!target) throw new Error(`Usage: vm ${action} <name|id>`)
        const vm = await findVm(target, ctx)
        const res = await consoleApiSend<{ vm: { name: string; status: string } }>(
          `/api/vms/${vm.id}/${action}`,
          'POST',
        )
        lines.push({ type: 'ok', text: `${res?.vm.name} → ${res?.vm.status}` })
        return lines
      }
      throw new Error('Usage: vm list|create|start|stop')
    }

    if (rootLower === 'audit') {
      const action = (sub ?? 'list').toLowerCase()
      if (action === 'list') {
        const { flags } = parseFlags(rest)
        const limit = parseInt(flags.limit ?? '20', 10)
        const data = await consoleApiGet<{
          auditLogs: { action: string; resourceType: string; createdAt?: string }[]
        }>('/api/audit-logs')
        const logs = data.auditLogs.slice(0, limit)
        lines.push({
          type: 'out',
          text: logs.length
            ? table([
                ['WHEN', 'ACTION', 'RESOURCE'],
                ...logs.map((l) => [
                  l.createdAt ? new Date(l.createdAt).toLocaleString() : '—',
                  l.action,
                  l.resourceType,
                ]),
              ])
            : 'No audit events.',
        })
        return lines
      }
      throw new Error('Usage: audit list [--limit 20]')
    }

    if (rootLower === 'billing') {
      const action = (sub ?? 'usage').toLowerCase()
      if (action === 'usage') {
        const data = await consoleApiGet<{
          usage: { computeSeconds: number; estimatedCost: number; currency: string }
        }>('/api/billing/usage')
        const u = data.usage
        lines.push({
          type: 'out',
          text: `Compute: ${u.computeSeconds}s — est. ${u.estimatedCost} ${u.currency}`,
        })
        return lines
      }
      if (action === 'invoices') {
        const data = await consoleApiGet<{
          invoices: { id: string; status: string; totalAmount: number; currency: string }[]
        }>('/api/billing/invoices')
        lines.push({
          type: 'out',
          text: data.invoices.length
            ? table([
                ['ID', 'STATUS', 'AMOUNT'],
                ...data.invoices.map((i) => [i.id.slice(-8), i.status, `${i.totalAmount} ${i.currency}`]),
              ])
            : 'No invoices.',
        })
        return lines
      }
      throw new Error('Usage: billing usage|invoices')
    }

    if (rootLower === 'graphql') {
      const query = raw.slice('graphql'.length).trim()
      if (!query) throw new Error('Usage: graphql { projects { id name } }')
      const data = await consoleApiSend<Record<string, unknown>>('/graphql', 'POST', { query })
      lines.push({ type: 'out', text: JSON.stringify(data, null, 2) })
      return lines
    }

    lines.push({ type: 'err', text: `Unknown command: ${root}. Type "help".` })
    return lines
  } catch (err: unknown) {
    lines.push({
      type: 'err',
      text: err instanceof Error ? err.message : 'Command failed',
    })
    return lines
  }
}

export function matchCommandPrefix(partial: string): string | null {
  const p = partial.trim().toLowerCase()
  if (!p) return null
  const hit = COMMAND_HINTS.find((h) => h.startsWith(p))
  return hit ?? null
}
