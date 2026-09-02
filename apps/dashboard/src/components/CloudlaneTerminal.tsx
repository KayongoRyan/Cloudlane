'use client'

import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { getApiBase } from '../lib/api'
import {
  matchCommandPrefix,
  QUICK_COMMANDS,
  runTerminalCommand,
  type TerminalLine,
} from '../lib/cloudlaneTerminal'

interface CloudlaneTerminalProps {
  open: boolean
  onClose: () => void
  projectId?: string
  projectName?: string
  onDataChange?: () => void
}

const WELCOME = `Cloudlane Terminal — full control plane in your browser
Type "help" for commands · Tab autocomplete · ↑↓ history · Ctrl+L clear · Esc close`

function buildWelcome(projectName?: string): TerminalLine {
  const proj = projectName ? `Project: ${projectName}` : 'No project selected — pick one in the top bar'
  return {
    type: 'sys',
    text: `${WELCOME}\n${proj}`,
  }
}

export default function CloudlaneTerminal({
  open,
  onClose,
  projectId,
  projectName,
  onDataChange,
}: CloudlaneTerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([buildWelcome(projectName)])
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [histIdx, setHistIdx] = useState(-1)
  const [busy, setBusy] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLElement>(null)

  const ctx = { projectId, projectName }

  useEffect(() => {
    if (!open) return
    setLines([buildWelcome(projectName)])
    setInput('')
    setHint(null)
    setHistIdx(-1)
    inputRef.current?.focus()
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, projectName])

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' })
  }, [lines])

  const append = useCallback((next: TerminalLine | TerminalLine[]) => {
    setLines((prev) => prev.concat(Array.isArray(next) ? next : [next]))
  }, [])

  const run = useCallback(async (raw: string) => {
    const cmd = raw.trim()
    if (!cmd) return
    if (cmd === 'clear') {
      setLines([])
      return
    }
    setBusy(true)
    try {
      const out = await runTerminalCommand(cmd, ctx)
      append(out)
      const mutating = ['deploy', 'db', 'lb', 'secret', 'bucket', 'gateway', 'graphql', 'vm'].some((p) =>
        cmd.toLowerCase().startsWith(p),
      )
      if (mutating && onDataChange) onDataChange()
    } finally {
      setBusy(false)
    }
  }, [append, ctx, onDataChange, projectId, projectName])

  const runQuick = (cmd: string) => {
    if (busy) return
    setHistory((h) => [cmd, ...h.filter((x) => x !== cmd)].slice(0, 100))
    setInput('')
    setHint(null)
    void run(cmd)
  }

  const quickGroups = useMemo(() => {
    const groups = new Map<string, string[]>()
    for (const { group, cmd } of QUICK_COMMANDS) {
      const list = groups.get(group) ?? []
      list.push(cmd)
      groups.set(group, list)
    }
    return [...groups.entries()]
  }, [])

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const cmd = input.trim()
    if (!cmd || busy) return
    setHistory((h) => [cmd, ...h.filter((x) => x !== cmd)].slice(0, 100))
    setHistIdx(-1)
    setInput('')
    setHint(null)
    void run(cmd)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault()
      setLines([])
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      const match = matchCommandPrefix(input)
      if (match) setInput(match)
      return
    }
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

  const onInputChange = (value: string) => {
    setInput(value)
    setHint(matchCommandPrefix(value))
  }

  if (!open) return null

  return (
    <div className="cl-terminal-backdrop" role="presentation" onClick={onClose}>
      <section
        ref={dialogRef}
        className="cl-terminal cl-terminal--expanded"
        role="dialog"
        aria-label="Cloudlane terminal"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="cl-terminal-head">
          <div className="cl-terminal-dots" aria-hidden>
            <span /><span /><span />
          </div>
          <div className="cl-terminal-title">
            <TerminalIcon />
            <span>Cloudlane Terminal</span>
          </div>
          <span className="cl-terminal-meta">
            {projectName ? projectName : 'No project'} · {getApiBase().replace(/^https?:\/\//, '')}
          </span>
          <button type="button" className="cl-terminal-close" onClick={onClose} aria-label="Close terminal">
            ✕
          </button>
        </header>

        <div className="cl-terminal-layout">
          <aside className="cl-terminal-sidebar">
            <p className="cl-terminal-sidebar-title">Quick commands</p>
            {quickGroups.map(([group, cmds]) => (
              <div key={group} className="cl-terminal-sidebar-group">
                <p className="cl-terminal-sidebar-group-label">{group}</p>
                <ul>
                  {cmds.map((cmd) => (
                    <li key={cmd}>
                      <button type="button" onClick={() => runQuick(cmd)} disabled={busy} title="Run">
                        {cmd}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </aside>

          <div className="cl-terminal-main">
            <div className="cl-terminal-body" ref={bodyRef}>
              {lines.map((line, i) => (
                <div key={`${i}-${line.text.slice(0, 16)}`} className={`cl-terminal-line cl-terminal-line--${line.type}`}>
                  {line.text.split('\n').map((part, j, arr) => (
                    <span key={j}>{part}{j < arr.length - 1 && <br />}</span>
                  ))}
                </div>
              ))}
              {busy && <div className="cl-terminal-line cl-terminal-line--sys">…</div>}
            </div>
            <form className="cl-terminal-input-row" onSubmit={onSubmit}>
              <span className="cl-terminal-prompt" aria-hidden>cloudlane</span>
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => onInputChange(e.target.value)}
                onKeyDown={onKeyDown}
                spellCheck={false}
                autoComplete="off"
                disabled={busy}
                aria-label="Terminal command"
                placeholder="help"
              />
              {hint && hint !== input.trim().toLowerCase() && (
                <span className="cl-terminal-hint" aria-hidden>{hint}</span>
              )}
            </form>
          </div>
        </div>
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
