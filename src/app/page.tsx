'use client'

import { useState, useEffect, useRef } from 'react'
import io, { Socket } from 'socket.io-client'
import Oscilloscope from './components/Oscilloscope'
import MediaPlayerFixed from './components/MediaPlayerFixed'
import { sanitizeMessage, sanitizeUsername } from './utils/security'

interface Message {
  id: string
  username: string
  content: string
  timestamp: Date | string | number
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
  const [cooldownInfo, setCooldownInfo] = useState<{
    isActive: boolean
    message: string
    remainingTime: number
    totalViolations: number
  } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const usernameMeasureRef = useRef<HTMLSpanElement>(null)
  const messageMeasureRef = useRef<HTMLSpanElement>(null)
  const [usernameCursorPosition, setUsernameCursorPosition] = useState(0)
  const [messageCursorPosition, setMessageCursorPosition] = useState(0)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, typingUsers])

  // Handle page visibility changes to prevent disconnections from tab throttling
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('Tab became hidden - maintaining connection')
      } else {
        console.log('Tab became visible - connection should be maintained')
        // Optionally ping the server to ensure connection is still alive
        if (socket && isConnected) {
          socket.emit('ping', { timestamp: Date.now() })
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [socket, isConnected])

  // Update cursor positions when text changes
  useEffect(() => {
    if (usernameMeasureRef.current) {
      setUsernameCursorPosition(usernameMeasureRef.current.offsetWidth)
    }
  }, [username])

  useEffect(() => {
    if (messageMeasureRef.current) {
      setMessageCursorPosition(messageMeasureRef.current.offsetWidth)
    }
  }, [currentMessage])

  useEffect(() => {
    if (isConnected && socket) {
      socket.on('message', (message: Message) => {
        // Skip messages from the current user (optimistic UI already added it)
        if (message.username === username) {
          return
        }
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
          content: `${data.username} has established uplink`,
          timestamp: new Date(),
          userColor: 'toxic'
        }
        setMessages(prev => [...prev, joinMessage])
      })

      socket.on('user_left', (data: { username: string, userColor?: string }) => {
        const leftMessage: Message = {
          id: Date.now() + Math.random().toString(),
          username: 'System',
          content: `${data.username} has severed uplink`,
          timestamp: new Date(),
          userColor: 'ember'
        }
        setMessages(prev => [...prev, leftMessage])
      })

      socket.on('user_count', (count: number) => {
        setUserCount(count)
      })

      socket.on('rate_limit_cooldown', (data: { 
        message: string, 
        remainingTime: number, 
        totalViolations: number 
      }) => {
        setCooldownInfo({
          isActive: true,
          message: data.message,
          remainingTime: data.remainingTime,
          totalViolations: data.totalViolations
        })

        // Start countdown timer
        const interval = setInterval(() => {
          setCooldownInfo(prev => {
            if (!prev || prev.remainingTime <= 1) {
              clearInterval(interval)
              return null
            }
            return {
              ...prev,
              remainingTime: prev.remainingTime - 1
            }
          })
        }, 1000)
      })

      return () => {
        socket.off('message')
        socket.off('typing')
        socket.off('user_joined')
        socket.off('user_left')
        socket.off('user_count')
        socket.off('rate_limit_cooldown')
      }
    }
  }, [isConnected, socket, userPositions, nextPosition])

  const connectToChat = () => {
    if (!username.trim()) return

    try {
      // Sanitize username before connecting
      const sanitizedUsername = sanitizeUsername(username.trim())
      
      const newSocket = io({
        // Match server configuration to prevent timeouts
        timeout: 60000,           // 60 seconds
        forceNew: false,          // Reuse existing connection if possible
        reconnection: true,       // Enable automatic reconnection
        reconnectionDelay: 1000,  // Wait 1 second before first reconnection
        reconnectionDelayMax: 5000, // Max 5 seconds between reconnection attempts
        reconnectionAttempts: 10, // Try up to 10 times (correct property name)
        transports: ['websocket', 'polling'], // Use same transports as server
      })
      
      newSocket.on('connect', () => {
        setIsConnected(true)
        setSocket(newSocket)
        newSocket.emit('join', { username: sanitizedUsername, userColor })
      })

      // Handle pong responses from server
      newSocket.on('pong', (data) => {
        console.log(`Pong received from server, latency: ${Date.now() - data.timestamp}ms`)
      })

      newSocket.on('disconnect', (reason) => {
        console.log('Disconnected:', reason)
        setIsConnected(false)
        // Don't clear socket here - let reconnection handle it
      })

      // Handle automatic reconnection
      newSocket.on('reconnect', (attemptNumber) => {
        console.log(`Reconnected after ${attemptNumber} attempts`)
        setIsConnected(true)
        // Re-join when reconnected
        newSocket.emit('join', { username: sanitizedUsername, userColor })
      })

      newSocket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`Reconnection attempt ${attemptNumber}`)
      })

      newSocket.on('reconnect_failed', () => {
        console.log('Reconnection failed - connection lost')
        setIsConnected(false)
        setSocket(null)
        // Could show a "connection lost" message to user here
      })

      // Handle connection errors
      newSocket.on('connect_error', (error) => {
        console.error('Connection error:', error)
      })
    } catch (error) {
      console.error('Username validation failed:', error)
      alert('Invalid username. Please use only letters, numbers, and basic punctuation (1-20 characters).')
    }
  }

  const sendMessage = () => {
    if (!currentMessage.trim() || !socket || !isConnected) return

    // Check if user is in cooldown
    if (cooldownInfo?.isActive) {
      // Don't send message, cooldown popup is already showing
      return
    }

    try {
      // Sanitize the message content
      const sanitizedContent = sanitizeMessage(currentMessage.trim())
      
      const message: Message = {
        id: Date.now() + Math.random().toString(),
        username,
        content: sanitizedContent,
        timestamp: new Date(),
        userColor
      }

      // Clear typing indicator before sending message
      handleTyping('')

      // Add message locally (optimistic UI)
      setMessages(prev => [...prev, message])
      
      // Send to server (server won't echo back to us)
      socket.emit('message', message)
      setCurrentMessage('')
    } catch (error) {
      console.error('Message validation failed:', error)
      // Could show user-friendly error here
    }
  }

  const handleTyping = (content: string) => {
    if (!socket || !isConnected) return
    
    try {
      // Sanitize typing content (allow empty string for "stopped typing")
      const sanitizedContent = content ? sanitizeMessage(content) : ''
      
      socket.emit('typing', { 
        username, 
        content: sanitizedContent, 
        userColor 
      })
    } catch (error) {
      // Silently ignore typing validation errors to avoid spam
      console.log('Typing content validation failed:', error)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      sendMessage()
    }
  }

  const formatTime = (date: Date | string | number) => {
    // Handle different timestamp formats
    let dateObj: Date
    
    if (date instanceof Date) {
      dateObj = date
    } else if (typeof date === 'string') {
      dateObj = new Date(date)
    } else if (typeof date === 'number') {
      dateObj = new Date(date)
    } else {
      // Fallback to current time if invalid
      dateObj = new Date()
    }
    
    // Validate the date object
    if (isNaN(dateObj.getTime())) {
      dateObj = new Date()
    }
    
    return dateObj.toLocaleTimeString('en-US', { 
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
                {/* Hidden span to measure text width */}
                <span 
                  ref={usernameMeasureRef}
                  className="absolute opacity-0 pointer-events-none whitespace-pre"
                  style={{ 
                    font: 'inherit',
                    fontSize: 'inherit',
                    fontFamily: 'inherit',
                    left: 0,
                    top: 0
                  }}
                >
                  {username}
                </span>
                <span 
                  className="absolute text-terminal-amber animate-cursor-blink pointer-events-none"
                  style={{ 
                    left: `${usernameCursorPosition}px`,
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

      {/* Rate Limit Cooldown Popup */}
      {cooldownInfo?.isActive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-black/90 border border-terminal-rust rounded-lg p-6 max-w-md mx-4">
            <div className="text-center">
              <div className="text-terminal-rust text-2xl mb-2">☣ SYSTEM LOCKDOWN</div>
              <div className="text-terminal-amber text-sm mb-4">
                TRANSMISSION FREQUENCY EXCEEDED
              </div>
              <div className="text-terminal-text text-xs mb-4">
                Network protocols prevent signal overflow.<br/>
                Cooling down transmission array...
              </div>
              <div className="bg-terminal-rust/20 rounded p-3 mb-4 border border-terminal-rust/50">
                <div className="text-terminal-rust text-3xl font-bold font-mono">
                  {cooldownInfo.remainingTime}s
                </div>
                <div className="text-terminal-dim text-xs">
                  BREACH COUNT: {cooldownInfo.totalViolations}
                </div>
              </div>
              <div className="text-terminal-dim text-xs">
                ► Await system clearance before resuming transmission
              </div>
            </div>
          </div>
        </div>
      )}
      
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
              disabled={cooldownInfo?.isActive}
              className={`bg-transparent border-none outline-none w-full text-terminal-text caret-transparent focus:outline-none focus:ring-0 focus:border-transparent text-sm ${
                cooldownInfo?.isActive ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              placeholder={cooldownInfo?.isActive ? "☣ TRANSMISSION BLOCKED ☣" : ""}
              autoFocus={!cooldownInfo?.isActive}
            />
            {/* Hidden span to measure text width */}
            <span 
              ref={messageMeasureRef}
              className="absolute opacity-0 pointer-events-none whitespace-pre text-sm"
              style={{ 
                font: 'inherit',
                fontSize: 'inherit',
                fontFamily: 'inherit',
                left: 0,
                top: 0
              }}
            >
              {currentMessage}
            </span>
            <span 
              className="absolute text-terminal-amber animate-cursor-blink pointer-events-none text-sm"
              style={{ 
                left: `${messageCursorPosition}px`,
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
