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
            return filtered
          }
        })
      })

      socket.on('user_joined', (data: { username: string, userColor?: string }) => {
        const joinMessage: Message = {
          id: Date.now() + Math.random().toString(),
          username: 'System',
          content: `${data.username} has joined the terminal`,
          timestamp: new Date(),
          userColor: 'toxic'
        }
        setMessages(prev => [...prev, joinMessage])
      })

      socket.on('user_left', (data: { username: string, userColor?: string }) => {
        const leftMessage: Message = {
          id: Date.now() + Math.random().toString(),
          username: 'System',
          content: `${data.username} has left the terminal`,
          timestamp: new Date(),
          userColor: 'ember'
        }
        setMessages(prev => [...prev, leftMessage])
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
  }, [isConnected, socket, userPositions, nextPosition])

  const connectToChat = () => {
    if (!username.trim()) return

    const newSocket = io()
    
    newSocket.on('connect', () => {
      setIsConnected(true)
      setSocket(newSocket)
      newSocket.emit('join', { username: username.trim(), userColor })
    })

    newSocket.on('disconnect', () => {
      setIsConnected(false)
    })
  }

  const sendMessage = () => {
    if (!currentMessage.trim() || !socket || !isConnected) return

    const message: Message = {
      id: Date.now() + Math.random().toString(),
      username,
      content: currentMessage.trim(),
      timestamp: new Date(),
      userColor
    }

    // Add message locally (optimistic UI)
    setMessages(prev => [...prev, message])
    
    // Send to server (server won't echo back to us)
    socket.emit('message', message)
    setCurrentMessage('')
  }

  const handleTyping = (content: string) => {
    if (!socket || !isConnected) return
    
    socket.emit('typing', { 
      username, 
      content, 
      userColor 
    })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendMessage()
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getUserColor = (color?: string) => {
    return color && COLOR_MAP[color] ? COLOR_MAP[color] : COLOR_MAP.steel
  }

  // Original terminal login screen
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
                  onKeyPress={(e) => e.key === 'Enter' && connectToChat()}
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

  // Original terminal chat interface
  return (
    <main className="h-screen bg-terminal-bg text-terminal-text font-mono flex flex-col overflow-hidden relative">
      <Oscilloscope typingData={typingUsers} currentTyping={currentMessage} />
      
      {/* User Count Dashboard */}
      <div className="fixed top-4 right-4 z-30 bg-black/80 backdrop-blur-sm rounded-lg border border-terminal-rust/50 p-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-terminal-rust animate-pulse"></div>
          <span className="text-terminal-rust text-sm font-mono">
            {userCount} {userCount === 1 ? 'user' : 'users'}
          </span>
        </div>
      </div>
      
      {/* Chat layout */}
      <div className="flex-1 p-6 overflow-hidden flex flex-col relative z-20">
        <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin bg-black/60 backdrop-blur-sm rounded p-4 border border-terminal-dark/30">
          {messages.map((message) => (
            <div key={message.id} className="animate-fade-in">
              <span className="text-terminal-dim text-xs">
                [{formatTime(message.timestamp)}]
              </span>
              <span 
                className={`ml-2 text-sm ${
                  message.username === 'System' 
                    ? 'text-terminal-bright' 
                    : message.username === username
                    ? 'text-terminal-amber'
                    : ''
                }`}
                style={{
                  color: message.userColor && message.username !== 'System'
                    ? COLOR_MAP[message.userColor] || '#cc6633'
                    : undefined
                }}
              >
                {message.username}:
              </span>
              <span className="ml-2 text-terminal-text text-sm break-words">
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
              <span 
                className="ml-2"
                style={{
                  color: user.userColor ? COLOR_MAP[user.userColor] || '#b8956a' : '#b8956a'
                }}
              >
                {user.username}:
              </span>
              <span className="ml-2 break-words">
                {user.content}
                <span className="animate-cursor-blink">█</span>
              </span>
            </div>
          ))}
          
          <div ref={messagesEndRef} />
        </div>
        
        <div className="flex items-center mt-4 pt-4 border-t border-gray-800 bg-black/60 backdrop-blur-sm rounded p-3">
          <span className="text-terminal-amber mr-2 text-sm">
            {username}@system:~$
          </span>
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={currentMessage}
              onChange={(e) => {
                setCurrentMessage(e.target.value)
                handleTyping(e.target.value)
              }}
              onKeyPress={handleKeyPress}
              onBlur={() => handleTyping('')}
              className="bg-transparent border-none outline-none w-full text-terminal-text caret-transparent focus:outline-none focus:ring-0 focus:border-transparent text-sm"
              placeholder=""
              autoFocus
            />
            <span 
              className="absolute text-terminal-amber animate-cursor-blink pointer-events-none text-sm"
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

      {/* Floating Media Player */}
      <MediaPlayerFixed socket={socket} username={username} />
    </main>
  )
}
