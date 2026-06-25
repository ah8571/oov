import '../globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  metadataBase: new URL('https://emmaline.app'),
  title: 'Voice Assistant For Real Conversations | Emmaline',
  description: 'Emmaline is a voice-first assistant for natural conversations, instant answers, and thoughtful note-taking.',
  alternates: {
    canonical: '/',
  },
  icons: {
    icon: '/black outline favicon.png',
    apple: '/apple-touch-icon.png',
    shortcut: '/black outline favicon.png'
  },
  openGraph: {
    title: 'Voice Assistant For Real Conversations | Emmaline',
    description: 'Emmaline is a voice-first assistant for natural conversations, instant answers, and thoughtful note-taking.',
    type: 'website',
    url: 'https://emmaline.app',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        {children}
      </body>
    </html>
  )
}
