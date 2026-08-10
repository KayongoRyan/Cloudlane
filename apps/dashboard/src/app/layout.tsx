import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Cloudlane Dashboard',
  description: 'Deploy and manage your containers on Cloudlane',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
