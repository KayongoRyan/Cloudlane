type LogoProps = {
  showWordmark?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: { icon: 28, text: '1rem' },
  md: { icon: 36, text: '1.15rem' },
  lg: { icon: 48, text: 'clamp(1.75rem, 3vw, 2.25rem)' },
}

/** Cloud with a rack/server badge nested at bottom-right — managed cloud + compute. */
function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Cloud body */}
      <path
        d="M12.5 26.5H25.2C28.9 26.5 31.5 24 31.5 20.8C31.5 18.1 29.7 15.9 27.2 15.3C26.6 11.9 23.7 9.5 20.1 9.5C17.2 9.5 14.7 11.1 13.5 13.4C13 13.3 12.5 13.2 12 13.2C9 13.2 6.5 15.6 6.5 18.6C6.5 21.7 9 26.5 12.5 26.5Z"
        fill="currentColor"
      />
      {/* Server / rack attached bottom-right */}
      <rect
        x="22.5"
        y="23"
        width="12"
        height="11"
        rx="2"
        fill="var(--cl-white, #fafafa)"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <line x1="25" y1="26.2" x2="32" y2="26.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <line x1="25" y1="28.8" x2="32" y2="28.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="30.8" cy="31.5" r="1" fill="currentColor" />
    </svg>
  )
}

export default function Logo({ showWordmark = true, size = 'md', className = '' }: LogoProps) {
  const dim = sizes[size]

  return (
    <span className={`cl-logo ${className}`.trim()}>
      <span className="cl-logo-mark" style={{ width: dim.icon, height: dim.icon }}>
        <LogoMark size={dim.icon} />
      </span>
      {showWordmark && (
        <span className="cl-logo-text" style={{ fontSize: dim.text }}>
          Cloud<span className="cl-logo-accent">lane</span>
        </span>
      )}
    </span>
  )
}
