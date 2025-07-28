'use client'

import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
  const router = useRouter()
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
  const [usernameCursorPosition, setUsernameCursorPosition] = useState(0)
  const [messageCursorPosition, setMessageCursorPosition] = useState(0)
  const [showCryptPopup, setShowCryptPopup] = useState(false)
  const [adminKey, setAdminKey] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [neuralNodePresent, setNeuralNodePresent] = useState(false)
  const [showAdminPanel, setShowAdminPanel] = useState(false)
  const [adminCommand, setAdminCommand] = useState('')
  const [targetIP, setTargetIP] = useState('')
  const [banReason, setBanReason] = useState('')
  const [targetUsername, setTargetUsername] = useState('')
  const [adminMessages, setAdminMessages] = useState<Message[]>([])
  const [typingTimeoutRef, setTypingTimeoutRef] = useState<NodeJS.Timeout | null>(null)
  const [isUserScrolledUp, setIsUserScrolledUp] = useState(false)
  const [newMessagesWhileScrolledUp, setNewMessagesWhileScrolledUp] = useState(0)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setIsUserScrolledUp(false)
    setNewMessagesWhileScrolledUp(0)
  }

  // Only auto-scroll on new messages, not typing events
  useEffect(() => {
    // Only auto-scroll if user hasn't manually scrolled up
    if (!isUserScrolledUp) {
      scrollToBottom()
    } else {
      // User is scrolled up and new messages arrived
      setNewMessagesWhileScrolledUp(prev => prev + 1)
    }
  }, [messages]) // Removed typingUsers from dependency array

  // Add scroll detection to track user scroll position
  useEffect(() => {
    const chatContainer = chatContainerRef.current
    if (!chatContainer) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = chatContainer
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50 // 50px threshold
      
      if (isAtBottom && isUserScrolledUp) {
        // User scrolled back to bottom
        setIsUserScrolledUp(false)
        setNewMessagesWhileScrolledUp(0)
      } else if (!isAtBottom && !isUserScrolledUp) {
        // User scrolled up
        setIsUserScrolledUp(true)
      }
    }

    chatContainer.addEventListener('scroll', handleScroll, { passive: true })
    return () => chatContainer.removeEventListener('scroll', handleScroll)
  }, [isUserScrolledUp])

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
      // Clean up typing timeout on unmount
      if (typingTimeoutRef) {
        clearTimeout(typingTimeoutRef)
      }
    }
  }, [socket, isConnected])

  // Simple character-based positioning for monospace fonts
  const getTextWidth = (text: string, fontSize: number) => {
    // Monospace character width approximation based on font size
    const charWidth = fontSize * 0.58 // Slightly smaller for better accuracy
    return text.length * charWidth
  }

  // Update cursor positions immediately
  useLayoutEffect(() => {
    setUsernameCursorPosition(getTextWidth(username, 16))
  }, [username])

  useLayoutEffect(() => {
    setMessageCursorPosition(getTextWidth(currentMessage, 14))
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

      // Handle admin-only messages
      socket.on('admin_message', (data: { id: string, content: string, timestamp: Date }) => {
        if (isAdmin) {
          const adminMessage: Message = {
            id: data.id,
            username: 'ADMIN',
            content: data.content,
            timestamp: data.timestamp
          }
          setAdminMessages(prev => [...prev, adminMessage])
        }
      })

      socket.on('user_joined', (data: { username: string, userColor?: string }) => {
        // Track NEURALNODE presence
        if (data.username === 'NEURALNODE') {
          setNeuralNodePresent(true)
        }
        
        const joinMessage: Message = {
          id: Date.now() + Math.random().toString(),
          username: 'System',
          content: `${data.username} HAS ESTABLISHED UPLINK`,
          timestamp: new Date(),
          userColor: 'toxic'
        }
        setMessages(prev => [...prev, joinMessage])
      })

      socket.on('user_left', (data: { username: string, userColor?: string }) => {
        // Track NEURALNODE presence
        if (data.username === 'NEURALNODE') {
          setNeuralNodePresent(false)
        }
        
        const leftMessage: Message = {
          id: Date.now() + Math.random().toString(),
          username: 'System',
          content: `${data.username} HAS SEVERED UPLINK`,
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
      const sanitizedUsername = sanitizeUsername(username.trim(), isAdmin)
      
      const newSocket = io({
        // Optimized for Cloudflare compatibility and stability
        timeout: 120000,                   // 2 minutes - matches server pingTimeout
        forceNew: false,                   // Reuse existing connection if possible
        reconnection: true,                // Enable automatic reconnection
        reconnectionDelay: 2000,           // Wait 2 seconds before first reconnection
        reconnectionDelayMax: 10000,       // Max 10 seconds between attempts
        reconnectionAttempts: 10,          // Fewer attempts but longer delays
        transports: ['websocket', 'polling'], // WebSocket first, polling fallback
        // Additional stability settings for Cloudflare
        autoConnect: true,                 // Connect automatically
        upgrade: true,                     // Allow WebSocket upgrades
        rememberUpgrade: true,             // Remember successful WebSocket upgrade
        rejectUnauthorized: false,         // Allow self-signed certificates in dev
        // Cloudflare-specific optimizations
        timestampRequests: true,           // Add timestamps to requests
        timestampParam: 't',               // Timestamp parameter name
      })
      
      newSocket.on('connect', () => {
        setIsConnected(true)
        setSocket(newSocket)
        newSocket.emit('join', { 
          username: sanitizedUsername, 
          userColor,
          adminKey: isAdmin ? adminKey : null
        })
      })

      // Handle pong responses from server
      newSocket.on('pong', (data) => {
        const latency = Date.now() - (data.clientTimestamp || data.timestamp)
        console.log(`Pong received from server, latency: ${latency}ms`)
      })

      // Handle health check responses
      newSocket.on('health_response', (data) => {
        console.log(`Health check response: ${data.status}, Server time: ${data.serverTime}, Users: ${data.connectedUsers}`)
      })

      // Periodic health checks to maintain connection stability
      const healthCheckInterval = setInterval(() => {
        if (newSocket.connected) {
          newSocket.emit('health_check')
        }
      }, 120000) // Every 2 minutes - less frequent

      // Store interval ID for cleanup
      const pingInterval = setInterval(() => {
        if (newSocket.connected) {
          newSocket.emit('ping', { timestamp: Date.now() })
        }
      }, 60000) // Every 60 seconds - less frequent

      newSocket.on('disconnect', (reason) => {
        console.log('Disconnected:', reason)
        setIsConnected(false)
        // Cleanup intervals
        clearInterval(healthCheckInterval)
        clearInterval(pingInterval)
        // Don't clear socket here - let reconnection handle it
      })

      // Handle automatic reconnection
      newSocket.on('reconnect', (attemptNumber) => {
        console.log(`Reconnected after ${attemptNumber} attempts`)
        setIsConnected(true)
        // Re-join when reconnected
        newSocket.emit('join', { 
          username: sanitizedUsername, 
          userColor,
          adminKey: isAdmin ? adminKey : null
        })
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

    // Check for ARG trigger phrase
    if (currentMessage.trim().toLowerCase() === 'enter the crypt') {
      setShowCryptPopup(true)
      setCurrentMessage('')
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

      // Clear typing indicator and timeout before sending message
      if (typingTimeoutRef) {
        clearTimeout(typingTimeoutRef)
        setTypingTimeoutRef(null)
      }
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
      // Clear existing timeout
      if (typingTimeoutRef) {
        clearTimeout(typingTimeoutRef)
        setTypingTimeoutRef(null)
      }
      
      // Sanitize typing content (allow empty string for "stopped typing")
      const sanitizedContent = content ? sanitizeMessage(content) : ''
      
      // Set new timeout if user is typing (3.5 minutes - slightly longer than server timeout)
      if (sanitizedContent) {
        const timeout = setTimeout(() => {
          socket.emit('typing', { username, content: '', userColor })
          setTypingTimeoutRef(null)
        }, 210000)
        setTypingTimeoutRef(timeout)
      }
      
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

  const handleAdminCommand = (command: string, ip?: string, reason?: string, username?: string) => {
    if (!isAdmin || !socket) return
    
    socket.emit('admin_command', {
      command,
      targetIP: ip,
      reason: reason,
      targetUsername: username
    })
    
    // Clear form
    setTargetIP('')
    setBanReason('')
    setTargetUsername('')
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
          
          {/* Admin Panel */}
          <div className="w-full max-w-md mt-4">
            <div className="bg-black/60 backdrop-blur-sm rounded p-6 border border-terminal-dark/40">
              <div className="text-center mb-4">
                <div className="text-terminal-rust text-sm mb-2">Admin Access</div>
              </div>
              
              <div className="flex items-center mb-4">
                <span className="text-terminal-rust mr-2 text-sm">admin key:</span>
                <div className="flex-1">
                  <input
                    type="password"
                    value={adminKey}
                    onChange={(e) => {
                      setAdminKey(e.target.value)
                      // Check admin key from environment variable
                      if (e.target.value === process.env.NEXT_PUBLIC_ADMIN_KEY) {
                        setIsAdmin(true)
                      } else {
                        setIsAdmin(false)
                      }
                    }}
                    className="bg-transparent border-none outline-none w-full text-terminal-text focus:outline-none focus:ring-0 focus:border-transparent text-sm"
                    placeholder="enter admin key"
                  />
                </div>
              </div>
              
              {isAdmin && (
                <div className="text-red-500 text-xs animate-pulse border border-red-500 p-2 bg-black/80 rounded">
                  ⚠ NEURAL ADMIN MODE ACTIVE ⚠<br/>
                  <span className="text-xs">NeuralNode username unlocked</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    )
  }

  // Original terminal chat interface
  return (
    <main className="h-screen bg-terminal-bg text-terminal-text font-mono flex flex-col overflow-hidden relative">
      <Oscilloscope 
        typingData={typingUsers} 
        currentTyping={currentMessage} 
        cryptLevel={username === 'NEURALNODE' || neuralNodePresent ? 4 : 0} 
      />
      
      {/* User Count Dashboard & Support */}
      <div className="fixed top-4 right-4 z-30 flex flex-col gap-2">
        <div className="bg-black/80 backdrop-blur-sm rounded-lg border border-terminal-rust/50 p-3">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-terminal-rust animate-pulse"></div>
            <span className="text-terminal-rust text-sm font-mono">
              {userCount} {userCount === 1 ? 'user' : 'users'}
            </span>
          </div>
        </div>
        <button
          onClick={() => router.push('/support')}
          className="bg-terminal-amber/90 text-black backdrop-blur-sm rounded-lg border border-terminal-amber p-2 hover:bg-terminal-amber transition-colors text-xs font-mono font-bold"
        >
          DONATE
        </button>
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

      {/* Admin Panel */}
      {isAdmin && (
        <div className="fixed top-4 left-4 z-30">
          <button
            onClick={() => setShowAdminPanel(!showAdminPanel)}
            className="bg-red-900/80 backdrop-blur-sm border border-red-500 text-red-400 px-3 py-2 text-xs font-mono hover:bg-red-800/80 transition-colors"
          >
            ADMIN PANEL
          </button>
          
          {showAdminPanel && (
            <div className="absolute top-12 left-0 bg-black/90 backdrop-blur-sm border border-red-500 rounded-lg p-4 w-80 max-h-96 overflow-y-auto">
              <div className="text-red-400 text-sm font-mono mb-4">🔨 ADMIN CONTROLS</div>
              
              {/* Admin Messages Display */}
              {adminMessages.length > 0 && (
                <div className="mb-4 border-b border-terminal-dim pb-4">
                  <div className="text-terminal-text text-xs mb-2">Admin Messages:</div>
                  <div className="bg-black/60 border border-terminal-dim rounded p-2 max-h-32 overflow-y-auto">
                    {adminMessages.slice(-5).map((msg) => (
                      <div key={msg.id} className="text-xs text-terminal-bright mb-1">
                        [{formatTime(msg.timestamp)}] {msg.content}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => setAdminMessages([])}
                    className="text-xs text-terminal-dim hover:text-terminal-text mt-1"
                  >
                    Clear Messages
                  </button>
                </div>
              )}
              
              {/* IP Ban Section */}
              <div className="mb-4">
                <div className="text-terminal-text text-xs mb-2">Ban IP Address:</div>
                <input
                  type="text"
                  value={targetIP}
                  onChange={(e) => setTargetIP(e.target.value)}
                  placeholder="IP address"
                  className="w-full bg-transparent border border-terminal-dim text-terminal-text font-mono text-xs p-2 mb-2"
                />
                <input
                  type="text"
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Reason (optional)"
                  className="w-full bg-transparent border border-terminal-dim text-terminal-text font-mono text-xs p-2 mb-2"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAdminCommand('ban_ip', targetIP, banReason)}
                    disabled={!targetIP.trim()}
                    className="bg-red-600 text-white px-3 py-1 text-xs font-mono hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
                  >
                    BAN IP
                  </button>
                  <button
                    onClick={() => handleAdminCommand('unban_ip', targetIP)}
                    disabled={!targetIP.trim()}
                    className="bg-green-600 text-white px-3 py-1 text-xs font-mono hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
                  >
                    UNBAN IP
                  </button>
                </div>
              </div>
              
              {/* User IP Lookup */}
              <div className="mb-4 border-t border-terminal-dim pt-4">
                <div className="text-terminal-text text-xs mb-2">Get User IP:</div>
                <input
                  type="text"
                  value={targetUsername}
                  onChange={(e) => setTargetUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full bg-transparent border border-terminal-dim text-terminal-text font-mono text-xs p-2 mb-2"
                />
                <button
                  onClick={() => handleAdminCommand('get_user_ip', undefined, undefined, targetUsername)}
                  disabled={!targetUsername.trim()}
                  className="bg-blue-600 text-white px-3 py-1 text-xs font-mono hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed w-full"
                >
                  GET USER IP
                </button>
              </div>
              
              {/* Quick Actions */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleAdminCommand('list_users')}
                  className="bg-terminal-amber text-black px-3 py-1 text-xs font-mono hover:bg-yellow-400"
                >
                  LIST ALL USERS & IPs
                </button>
                <button
                  onClick={() => handleAdminCommand('list_bans')}
                  className="bg-orange-600 text-white px-3 py-1 text-xs font-mono hover:bg-orange-500"
                >
                  LIST BANNED IPs
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Chat layout */}
      <div className="flex-1 p-6 overflow-hidden flex flex-col relative z-20">
        {/* New messages indicator */}
        {isUserScrolledUp && newMessagesWhileScrolledUp > 0 && (
          <div className="absolute top-8 left-1/2 transform -translate-x-1/2 z-30">
            <button
              onClick={scrollToBottom}
              className="bg-terminal-amber text-black px-4 py-2 rounded-lg font-mono text-sm shadow-lg hover:bg-yellow-400 transition-colors animate-pulse"
            >
              {newMessagesWhileScrolledUp} new message{newMessagesWhileScrolledUp > 1 ? 's' : ''} ↓
            </button>
          </div>
        )}
        
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto space-y-1 scrollbar-thin bg-black/60 backdrop-blur-sm rounded p-4 border border-terminal-dark/30"
        >
          {messages.map((message) => (
            <div key={message.id} className="animate-fade-in">
              <span className="text-terminal-dim text-xs">
                [{formatTime(message.timestamp)}]
              </span>
              <span 
                className={`ml-2 ${
                  message.username === 'System' 
                    ? 'text-terminal-bright font-bold text-sm' 
                    : message.username === 'NEURALNODE'
                    ? 'font-bold text-xl'
                    : message.username === username
                    ? 'text-terminal-amber text-sm'
                    : 'text-sm'
                }`}
                style={{
                  color: message.username === 'NEURALNODE'
                    ? 'rgb(255, 0, 0)'
                    : (message.userColor && message.username !== 'System' && message.username !== 'NEURALNODE')
                    ? COLOR_MAP[message.userColor] || '#cc6633'
                    : undefined
                }}
              >
                {message.username === 'System' ? 'SYSTEM' : message.username}:
              </span>
              <span 
                className={`ml-2 break-words ${
                  message.username === 'NEURALNODE'
                    ? 'font-bold text-xl'
                    : 'text-terminal-text text-sm'
                }`}
                style={{
                  color: message.username === 'NEURALNODE' ? 'rgb(255, 0, 0)' : undefined
                }}
              >
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

      {/* Crypt Door Popup */}
      {showCryptPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
          <div className="bg-terminal-bg border-2 border-terminal-amber p-8 max-w-lg text-center terminal-text">
            <div className="text-terminal-text font-mono mb-8 text-center whitespace-pre-line">
              {`Before you stands a weathered concrete tomb.

The air thickens and the stench of rot chokes you.

Will you slide open its ancient doors?`}
            </div>
            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  setShowCryptPopup(false)
                  // Navigate to the crypt entrance terminal
                  router.push('/crypt')
                }}
                className="bg-terminal-amber text-black px-6 py-2 font-mono hover:bg-yellow-400 transition-colors"
              >
                YES
              </button>
              <button
                onClick={() => setShowCryptPopup(false)}
                className="bg-gray-600 text-white px-6 py-2 font-mono hover:bg-gray-500 transition-colors"
              >
                NO
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
