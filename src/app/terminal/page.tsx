'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { io, Socket } from 'socket.io-client'
import Terminal from '../components/Terminal'

export default function TerminalPage() {
  const router = useRouter()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [username, setUsername] = useState<string>('')
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    // Get username from localStorage or prompt
    const storedUsername = localStorage.getItem('neuralnode_username')
    if (!storedUsername) {
      router.push('/')
      return
    }
    
    setUsername(storedUsername)

    // Connect to socket
    const newSocket = io(process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3000', {
      transports: ['websocket', 'polling'],
    })

    newSocket.on('connect', () => {
      setIsConnected(true)
      // Join with existing username
      newSocket.emit('join', { 
        username: storedUsername,
        color: localStorage.getItem('neuralnode_color') || 'terminal-amber'
      })
    })

    newSocket.on('disconnect', () => {
      setIsConnected(false)
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }, [router])

  return (
    <main className="min-h-screen bg-terminal-bg text-terminal-text font-mono flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-terminal-dark/30">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="bg-terminal-rust/90 text-terminal-bright px-4 py-2 rounded border border-terminal-rust hover:bg-terminal-rust transition-colors text-sm font-mono"
          >
            ← BACK TO CHAT
          </button>
          <h1 className="text-terminal-amber text-xl font-mono">NEURALNODE SHARED TERMINAL</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
          <span className="text-terminal-text text-sm font-mono">
            {isConnected ? 'CONNECTED' : 'DISCONNECTED'}
          </span>
        </div>
      </div>

      {/* Terminal Container */}
      <div className="flex-1 p-6 flex items-center justify-center">
        <div className="w-full max-w-6xl h-[600px]">
          <Terminal 
            socket={socket} 
            isVisible={true} 
            onClose={() => router.push('/')}
            username={username}
          />
        </div>
      </div>
    </main>
  )
}