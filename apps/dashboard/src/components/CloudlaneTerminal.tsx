'use client'

import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import { getApiBase } from '../lib/api'

interface Deployment {
  id: string
  name: string
  image: string
  status: string
  publicUrl?: string
}

interface CloudlaneTerminalProps {
  open: boolean
  onClose: () => void
  projectId?: string
  projectName?: string
}

type Line = { type: 'in' | 'out' | 'err' | 'sys'; text: string }

const WELCOME = `Cloudlane Terminal — local workspace + cloud control plane
Type "help" for commands. Tracks this browser session and your Cloudlane deployments.`

export default function CloudlaneTerminal({
  open,
  onClose,
  projectId,
  projectName,
}: CloudlaneTerminalProps) {
  const [lines, setLines] = useState<Line[]>([{ type: 'sys', text: WELCOME }])
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
      bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight })
    }
  }, [open])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [lines])

  const append = useCallback((next: Line | Line[]) => {
    setLines((prev) => prev.concat(Array.isArray(next) ? next : [next]))
  }, [])

  const fetchDeployments = useCallback(async (): Promise<Deployment[]> => {
    const token = localStorage.getItem('token')
    if (!token) throw new Error('Not signed in')
    const q = projectId ? `?projectId=${projectId}` : ''
    const res = await fetch(`${getApiBase()}/api/deployments${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('Failed to load deployments')
    const data = await res.json()
    return data.deployments ?? []
  }, [projectId])

  const runCommand = useCallback(async (raw: string) => {
    const cmd = raw.trim()
    if (!cmd) return

    append({ type: 'in', text: `$ ${cmd}` })

    const [name, ...rest] = cmd.split(/\s+/)
    const arg = rest.join(' ')

    try {
      switch (name.toLowerCase()) {
        case 'help':
          append({
            type: 'out',
            text: [
              'help          — this message',
              'status        — control plane + project health',
              'local         — this machine / browser context',
              'projects      — active project',
              'deployments   — list cloud deployments',
              'deploy <n>    — hint: use console or cloudlane deploy',
              'logs <name>   — tail logs (requires CLI)',
              'clear         — clear terminal',
              'exit          — close terminal',
            ].join('\n'),
          })
          break
        case 'clear':
          setLines([])
          break
        case 'exit':
          onClose()
          break
        case 'status': {
          const health = await fetch(`${getApiBase()}/health`).then((r) => r.ok).catch(() => false)
          append({
            type: 'out',
            text: [
              `API: ${health ? 'reachable' : 'unreachable'}`,
              `Project: ${projectName ?? '—'} (${projectId ?? 'none'})`,
              'Local agent: browser session (install Cloudlane CLI for full host tracking)',
            ].join('\n'),
          })
          break
        }
        case 'local':
          append({
            type: 'out',
            text: [
              `Platform: ${navigator.platform}`,
              `Language: ${navigator.language}`,
              `Online: ${navigator.onLine ? 'yes' : 'no'}`,
              `Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
              'Note: cloudlane CLI on your machine syncs local repos, Docker, and kubeconfig.',
            ].join('\n'),
          })
          break
        case 'projects':
          append({
            type: 'out',
            text: projectName
              ? `Active: ${projectName} (${projectId})`
              : 'No project selected.',
          })
          break
        case 'deployments': {
          const deps = await fetchDeployments()
          if (!deps.length) {
            append({ type: 'out', text: 'No deployments in this project.' })
            break
          }
          append({
            type: 'out',
            text: deps.map((d) =>
              `${d.name.padEnd(16)} ${d.status.padEnd(10)} ${d.publicUrl ?? d.image}`,
            ).join('\n'),
          })
          break
        }
        case 'deploy':
          append({
            type: 'out',
            text: arg
              ? `Deploy "${arg}" via: cloudlane deploy --name ${arg} --image <image>`
              : 'Usage: deploy <service-name>',
          })
          break
        case 'logs':
          append({
            type: 'out',
            text: arg
              ? `Run locally: cloudlane logs ${arg}`
              : 'Usage: logs <service-name>',
          })
          break
        default:
          append({ type: 'err', text: `Unknown command: ${name}. Type "help".` })
      }
    } catch (err: unknown) {
      append({
        type: 'err',
        text: err instanceof Error ? err.message : 'Command failed',
      })
    }
  }, [append, fetchDeployments, onClose, projectId, projectName])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const cmd = input.trim()
    if (!cmd) return
    setHistory((h) => [cmd, ...h].slice(0, 50))
    setHistIdx(-1)
    setInput('')
    void runCommand(cmd)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!history.length) return
      const next = Math.min(histIdx + 1, history.length - 1)
      setHistIdx(next)
      setInput(history[next])
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (histIdx <= 0) {
        setHistIdx(-1)
        setInput('')
        return
      }
      const next = histIdx - 1
      setHistIdx(next)
      setInput(history[next])
    }
  }

  if (!open) return null

  return (
    <div className="cl-terminal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="cl-terminal"
        role="dialog"
        aria-label="Cloudlane terminal"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cl-terminal-head">
          <div className="cl-terminal-title">
            <TerminalIcon />
            <span>Cloudlane Terminal</span>
          </div>
          <span className="cl-terminal-meta">
            {projectName ? `Project: ${projectName}` : 'No project'}
          </span>
          <button type="button" className="cl-terminal-close" onClick={onClose} aria-label="Close terminal">
            ✕
          </button>
        </header>
        <div className="cl-terminal-body" ref={bodyRef}>
          {lines.map((line, i) => (
            <div key={`${i}-${line.text.slice(0, 12)}`} className={`cl-terminal-line cl-terminal-line--${line.type}`}>
              {line.text.split('\n').map((part, j) => (
                <span key={j}>{part}{j < line.text.split('\n').length - 1 && <br />}</span>
              ))}
            </div>
          ))}
        </div>
        <form className="cl-terminal-input-row" onSubmit={onSubmit}>
          <span className="cl-terminal-prompt" aria-hidden>$</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoComplete="off"
            aria-label="Terminal command"
            placeholder="help"
          />
        </form>
      </section>
    </div>
  )
}

function TerminalIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M7 9l3 3-3 3M12 15h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
