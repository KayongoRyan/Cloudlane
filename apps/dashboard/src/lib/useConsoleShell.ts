'use client'

import { RefObject, useEffect } from 'react'

export function useConsoleShell(navOpen: boolean, topbarRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    document.documentElement.classList.add('cl-gc-root')
    document.body.classList.add('cl-gc-body')
    document.body.classList.toggle('nav-lock', navOpen)
    return () => {
      document.documentElement.classList.remove('cl-gc-root')
      document.body.classList.remove('cl-gc-body', 'nav-lock')
    }
  }, [navOpen])

  useEffect(() => {
    const el = topbarRef.current
    if (!el) return

    const syncTopbarHeight = () => {
      document.documentElement.style.setProperty('--cl-topbar-h', `${el.offsetHeight}px`)
    }

    syncTopbarHeight()
    const observer = new ResizeObserver(syncTopbarHeight)
    observer.observe(el)
    window.addEventListener('resize', syncTopbarHeight)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', syncTopbarHeight)
      document.documentElement.style.removeProperty('--cl-topbar-h')
    }
  }, [topbarRef])
}
