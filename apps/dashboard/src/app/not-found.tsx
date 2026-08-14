import Link from 'next/link'
import Logo from '../components/Logo'

export default function NotFound() {
  return (
    <main className="cl-empty-page">
      <Logo size="lg" />
      <h1>Page not found</h1>
      <p>The route you tried to access does not exist.</p>
      <Link href="/" className="cl-btn-primary">
        Back to home
      </Link>
    </main>
  )
}
