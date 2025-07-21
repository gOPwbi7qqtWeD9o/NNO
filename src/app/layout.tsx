import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'NNO',
  description: 'Real-time neural interface chat system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-mono">{children}</body>
    </html>
  )
}
