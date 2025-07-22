'use client'

import { useState, useEffect, useRef } from 'react'
import io, { Socket } from 'socket.io-client'
import Oscilloscope from './components/Oscilloscope'
// import MediaPlayer from './components/MediaPlayer'

interface Message {
  id: string
  username: string
  content: string
  timestamp: Date
}

interface TypingUser {
  username: string
  content: string
  position?: number
}

export default function TerminalChat() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [currentMessage, setCurrentMessage] = useState('')
  const [username, setUsername] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([])
  const [userCount, setUserCount] = useState<number>(0)
  const [userPositions, setUserPositions] = useState<Map<string, number>>(new Map())
  const [nextPosition, setNextPosition] = useState<number>(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, typingUsers])

  useEffect(() => {
    if (isConnected && socket) {
      socket.on('message', (message: Message) => {
        setMessages(prev => [...prev, message])
      })

      socket.on('typing', (data: { username: string, content: string }) => {
        setTypingUsers(prev => {
          const filtered = prev.filter(user => user.username !== data.username)
          if (data.content) {
            // Check if user already has a position
            let userPosition = userPositions.get(data.username)
            if (userPosition === undefined) {
              userPosition = nextPosition
              setUserPositions(positions => {
                const newPositions = new Map(positions)
                newPositions.set(data.username, userPosition!)
                return newPositions
              })
              setNextPosition(pos => pos + 1)
            }
            
            return [...filtered, { 
              username: data.username, 
              content: data.content,
              position: userPosition
            }]
          } else {
            // User stopped typing, remove their position
            setUserPositions(positions => {
              const newPositions = new Map(positions)
              newPositions.delete(data.username)
              return newPositions
            })
          }
          return filtered
        })
      })

      socket.on('user_joined', (data: { username: string }) => {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          username: 'SYSTEM',
          content: `${data.username} has joined the chat`,
          timestamp: new Date()
        }])
      })

      socket.on('user_left', (data: { username: string }) => {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          username: 'SYSTEM',
          content: `${data.username} has left the chat`,
          timestamp: new Date()
        }])
        setTypingUsers(prev => prev.filter(user => user.username !== data.username))
        // Clean up user position when they leave
        setUserPositions(positions => {
          const newPositions = new Map(positions)
          newPositions.delete(data.username)
          return newPositions
        })
      })

      socket.on('user_count', (count: number) => {
        setUserCount(count)
      })

      return () => {
        socket.off('message')
        socket.off('typing')
        socket.off('user_joined')
        socket.off('user_left')
        socket.off('user_count')
      }
    }
  }, [socket, isConnected])

  const connectToChat = () => {
    if (username.trim()) {
      const newSocket = io({
        secure: true,
        transports: ['websocket', 'polling']
      })
      setSocket(newSocket)
      setIsConnected(true)
      
      newSocket.emit('join', { username: username.trim() })
      
      // Welcome message
      setMessages([{
        id: '0',
        username: 'SYSTEM',
        content: `Uplink established. Operator ${username.trim()} verified.`,
        timestamp: new Date()
      }])
    }
  }

  const sendMessage = () => {
    if (socket && currentMessage.trim()) {
      const message: Message = {
        id: Date.now().toString(),
        username,
        content: currentMessage.trim(),
        timestamp: new Date()
      }
      
      socket.emit('message', message)
      socket.emit('typing', { username, content: '' })
      setCurrentMessage('')
    }
  }

  const handleTyping = (value: string) => {
    setCurrentMessage(value)
    if (socket) {
      socket.emit('typing', { username, content: value })
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (isConnected) {
        sendMessage()
      } else {
        connectToChat()
      }
    }
  }

  const formatTime = (timestamp: Date | string) => {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp)
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    })
  }

  if (!isConnected) {
    return (
      <main className="min-h-screen bg-terminal-bg text-terminal-text font-mono p-8 flex items-center justify-center">
        <div className="w-full max-w-md">
          <div className="bg-black/60 backdrop-blur-sm rounded p-6 border border-terminal-dark/40">
            <div className="text-center mb-6">
              <div className="text-terminal-amber text-lg mb-2">System Access</div>
              <div className="text-terminal-dim text-sm">Enter username to connect</div>
            </div>
            
            <div className="flex items-center">
              <span className="text-terminal-rust mr-2">username:</span>
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="bg-transparent border-none outline-none w-full text-terminal-text caret-transparent focus:outline-none focus:ring-0 focus:border-transparent"
                  placeholder=""
                  autoFocus
                />
                <span 
                  className="absolute text-terminal-amber animate-cursor-blink pointer-events-none"
                  style={{ 
                    left: `${username.length * 0.6}em`,
                    top: 0,
                    lineHeight: 'inherit'
                  }}
                >
                  █
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="h-screen bg-terminal-bg text-terminal-text font-mono flex flex-col overflow-hidden relative">
      <Oscilloscope typingData={typingUsers} currentTyping={currentMessage} />
      
      {/* User Count Dashboard - Top Right Corner */}
      <div className="fixed top-4 right-4 z-30 bg-black/80 backdrop-blur-sm rounded-lg border border-terminal-rust/50 p-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-terminal-rust animate-pulse"></div>
          <span className="text-terminal-rust text-sm font-mono">
            {userCount} {userCount === 1 ? 'user' : 'users'}
          </span>
        </div>
      </div>
      
      {/* Full screen chat with floating media player */}
      <div className="flex-1 p-6 overflow-hidden flex flex-col relative z-20">
        <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin bg-black/60 backdrop-blur-sm rounded p-4 border border-terminal-dark/30">
          {messages.map((message) => (
            <div key={message.id} className="animate-fade-in">
              <span className="text-terminal-dim text-xs">
                [{formatTime(message.timestamp)}]
              </span>
              <span className={`ml-2 text-sm ${
                message.username === 'SYSTEM' 
                  ? 'text-terminal-bright' 
                  : message.username === username
                  ? 'text-terminal-amber'
                  : 'text-terminal-rust'
              }`}>
                {message.username}:
              </span>
              <span className="ml-2 text-terminal-text">
                {message.content}
              </span>
            </div>
          ))}
          
          {typingUsers
            .sort((a, b) => (a.position || 0) - (b.position || 0))
            .map((user) => (
            <div key={user.username} className="text-terminal-dim text-sm opacity-75">
              <span className="text-terminal-dark text-xs">
                [typing]
              </span>
              <span className="ml-2 text-terminal-rust">
                {user.username}:
              </span>
              <span className="ml-2">
                {user.content}
                <span className="animate-cursor-blink">█</span>
              </span>
            </div>
          ))}
          
          <div ref={messagesEndRef} />
        </div>
        
        <div className="flex items-center mt-4 pt-4 border-t border-gray-800 bg-black/60 backdrop-blur-sm rounded p-3">
          <span className="text-terminal-amber mr-2">
            {username}@system:~$
          </span>
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={currentMessage}
              onChange={(e) => handleTyping(e.target.value)}
              onKeyDown={handleKeyDown}
              className="bg-transparent border-none outline-none w-full text-terminal-text caret-transparent focus:outline-none focus:ring-0 focus:border-transparent"
              placeholder=""
              autoFocus
            />
            <span 
              className="absolute text-terminal-amber animate-cursor-blink pointer-events-none"
              style={{ 
                left: `${currentMessage.length * 0.6}em`,
                top: 0,
                lineHeight: 'inherit'
              }}
            >
              █
            </span>
          </div>
        </div>
      </div>

      {/* Floating Media Player - commented out for launch */}
      {/* <MediaPlayer /> */}
    </main>
  )
}
