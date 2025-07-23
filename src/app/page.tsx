'use client'

import { useState, useEffect, useRef } from 'react'
import io, { Socket } from 'socket.io-client'
import Oscilloscope from './components/Oscilloscope'
import MediaPlayerFixed from './components/MediaPlayerFixed'

interface Message {
  id: string
  username: string
  content: string
  timestamp: Date
  userColor?: string
}

interface TypingUser {
  username: string
  content: string
  position?: number
  userColor?: string
}

const USER_COLORS = [
  'steel', 'rust', 'copper', 'acid', 
  'plasma', 'neon', 'ember', 'chrome', 
  'toxic', 'voltage', 'cobalt', 'mercury'
]

// Color mapping for direct style application
const COLOR_MAP: Record<string, string> = {
  steel: '#8892b0',
  rust: '#cc6633', 
  copper: '#b87333',
  acid: '#9acd32',
  plasma: '#da70d6',
  neon: '#00ffff',
  ember: '#ff4500',
  chrome: '#c0c0c0',
  toxic: '#32cd32',
  voltage: '#ffd700',
  cobalt: '#4169e1',
  mercury: '#e5e5e5'
}

export default function TerminalChat() {
  const [socket, setSocket] = useState<Socket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [currentMessage, setCurrentMessage] = useState('')
  const [username, setUsername] = useState('')
  const [userColor, setUserColor] = useState('steel')
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

      socket.on('typing', (data: { username: string, content: string, userColor?: string }) => {
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
              position: userPosition,
              userColor: data.userColor
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
  }, [socket, isConnected, userPositions, nextPosition])

  const connectToChat = () => {
    if (username.trim()) {
      const newSocket = io({
        secure: true,
        transports: ['websocket', 'polling']
      })
      setSocket(newSocket)
      setIsConnected(true)
      
      newSocket.emit('join', { username: username.trim(), userColor })
      
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
        timestamp: new Date(),
        userColor
      }
      
      // Optimistic UI - add message immediately
      setMessages(prev => [...prev, message])
      
      socket.emit('message', message)
      socket.emit('typing', { username, content: '' })
      setCurrentMessage('')
    }
  }

  const handleTyping = (value: string) => {
    setCurrentMessage(value)
    if (socket) {
      socket.emit('typing', { username, content: value, userColor })
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
            
            <div className="flex items-center mb-4">
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

            {/* Color Selection */}
            <div className="mb-4">
              <div className="text-terminal-rust text-sm mb-2">color scheme:</div>
              <div className="grid grid-cols-6 gap-2">
                {USER_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setUserColor(color)}
                    className={`w-8 h-8 rounded border-2 transition-all hover:scale-110 ${
                      userColor === color 
                        ? 'border-terminal-amber shadow-lg shadow-terminal-amber/50' 
                        : 'border-terminal-dark/40 hover:border-terminal-dim'
                    }`}
                    style={{ backgroundColor: COLOR_MAP[color] || '#cc6633' }}
                    title={color}
                  />
                ))}
              </div>
              <div className="text-terminal-dim text-xs mt-1 text-center">
                selected: <span style={{ color: COLOR_MAP[userColor] || '#cc6633' }}>{userColor}</span>
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
      
      {/* User Count Dashboard - Responsive positioning */}
      <div className="fixed top-2 right-2 sm:top-4 sm:right-4 z-30 bg-black/80 backdrop-blur-sm rounded-lg border border-terminal-rust/50 p-2 sm:p-3">
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-terminal-rust animate-pulse"></div>
          <span className="text-terminal-rust text-xs sm:text-sm font-mono">
            {userCount} {userCount === 1 ? 'user' : 'users'}
          </span>
        </div>
      </div>
      
      {/* Mobile-optimized chat layout */}
      <div className="flex-1 p-2 sm:p-6 overflow-hidden flex flex-col relative z-20">
        <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin bg-black/60 backdrop-blur-sm rounded p-2 sm:p-4 border border-terminal-dark/30">
          {messages.map((message) => (
            <div key={message.id} className="animate-fade-in">
              <span className="text-terminal-dim text-xs">
                [{formatTime(message.timestamp)}]
              </span>
              <span 
                className={`ml-1 sm:ml-2 text-xs sm:text-sm ${
                  message.username === 'SYSTEM' 
                    ? 'text-terminal-bright' 
                    : message.username === username
                    ? 'text-terminal-amber'
                    : ''
                }`}
                style={{
                  color: message.userColor && message.username !== 'SYSTEM'
                    ? COLOR_MAP[message.userColor] || '#cc6633' // Show colors for everyone including yourself
                    : undefined
                }}
              >
                {message.username}:
              </span>
              <span className="ml-1 sm:ml-2 text-terminal-text text-xs sm:text-sm break-words">
                {message.content}
              </span>
            </div>
          ))}
          
          {typingUsers
            .sort((a, b) => (a.position || 0) - (b.position || 0))
            .map((user) => (
            <div key={user.username} className="text-terminal-dim text-xs sm:text-sm opacity-75">
              <span className="text-terminal-dark text-xs">
                [typing]
              </span>
              <span 
                className="ml-1 sm:ml-2"
                style={{
                  color: user.userColor ? COLOR_MAP[user.userColor] || '#b8956a' : '#b8956a'
                }}
              >
                {user.username}:
              </span>
              <span className="ml-1 sm:ml-2 break-words">
                {user.content}
                <span className="animate-cursor-blink">█</span>
              </span>
            </div>
          ))}
          
          <div ref={messagesEndRef} />
        </div>
        
        <div className="flex items-center mt-2 sm:mt-4 pt-2 sm:pt-4 border-t border-gray-800 bg-black/60 backdrop-blur-sm rounded p-2 sm:p-3">
          <span className="text-terminal-amber mr-1 sm:mr-2 text-xs sm:text-sm hidden sm:inline">
            {username}@system:~$
          </span>
          <span className="text-terminal-amber mr-1 text-xs sm:hidden">
            $
          </span>
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={currentMessage}
              onChange={(e) => handleTyping(e.target.value)}
              onKeyDown={handleKeyDown}
              className="bg-transparent border-none outline-none w-full text-terminal-text caret-transparent focus:outline-none focus:ring-0 focus:border-transparent text-xs sm:text-sm"
              placeholder=""
              autoFocus
            />
            <span 
              className="absolute text-terminal-amber animate-cursor-blink pointer-events-none text-xs sm:text-sm"
              style={{ 
                left: `${currentMessage.length * (typeof window !== 'undefined' && window.innerWidth < 768 ? 0.5 : 0.6)}em`,
                top: 0,
                lineHeight: 'inherit'
              }}
            >
              █
            </span>
          </div>
        </div>
      </div>

      {/* Floating Media Player */}
      <MediaPlayerFixed socket={socket} username={username} />
    </main>
  )
}
