const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')
const DOMPurify = require('dompurify')
const validator = require('validator')
const { JSDOM } = require('jsdom')

// Security setup
const window = new JSDOM('').window
const purify = DOMPurify(window)

// Security functions
function sanitizeHtml(html) {
  if (!html || typeof html !== 'string') return ''
  return purify.sanitize(html, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  })
}

function sanitizeUsername(username) {
  if (!username || typeof username !== 'string') {
    throw new Error('Invalid username')
  }
  
  const clean = sanitizeHtml(username.trim())
  
  if (clean.length < 1 || clean.length > 20) {
    throw new Error('Username must be 1-20 characters')
  }
  
  if (!/^[a-zA-Z0-9\s\-_\.]+$/.test(clean)) {
    throw new Error('Username contains invalid characters')
  }
  
  // Enhanced system username protection
  const lowerClean = clean.toLowerCase()
  const bannedNames = [
    'system', 'admin', 'administrator', 'root', 'mod', 'moderator',
    'bot', 'server', 'null', 'undefined', 'anonymous', 'guest',
    'sys', 'sysadmin', 'support', 'help', 'service'
  ]
  
  if (bannedNames.includes(lowerClean)) {
    throw new Error('Username is reserved')
  }
  
  // Prevent variations like "System", "SYSTEM", "5ystem", etc.
  if (lowerClean.includes('system') || lowerClean.includes('admin')) {
    throw new Error('Username contains restricted terms')
  }
  
  return clean
}

function sanitizeMessage(message) {
  if (!message || typeof message !== 'string') {
    throw new Error('Invalid message')
  }
  
  const clean = sanitizeHtml(message.trim())
  
  if (clean.length < 1) {
    throw new Error('Message cannot be empty')
  }
  
  if (clean.length > 1000) {
    throw new Error('Message too long')
  }
  
  return clean
}

// Rate limiting
class RateLimiter {
  constructor(maxRequests = 10, windowMs = 60000) {
    this.requests = new Map()
    this.maxRequests = maxRequests
    this.windowMs = windowMs
  }
  
  isAllowed(identifier) {
    const now = Date.now()
    const userRequests = this.requests.get(identifier) || []
    
    const validRequests = userRequests.filter(
      timestamp => now - timestamp < this.windowMs
    )
    
    if (validRequests.length >= this.maxRequests) {
      return false
    }
    
    validRequests.push(now)
    this.requests.set(identifier, validRequests)
    return true
  }
}

// Rate limiters
const messageRateLimit = new RateLimiter(30, 60000) // 30 messages per minute
const typingRateLimit = new RateLimiter(60, 60000)  // 60 typing events per minute
const joinRateLimit = new RateLimiter(5, 60000)     // 5 joins per minute

// Cooldown tracking for rate-limited users
const userCooldowns = new Map() // socketId -> { endTime, messageCount }

const dev = process.env.NODE_ENV !== 'production'
const hostname = '0.0.0.0' // Railway requires 0.0.0.0
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  // Railway handles SSL termination, so we only need HTTP server
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    // Important for Railway deployment
    transports: ['websocket', 'polling'],
    allowEIO3: true
  })

  // Store for connected users and their typing states
  const connectedUsers = new Map()
  const typingStates = new Map()
  const disconnectionTimeouts = new Map() // Grace period for reconnections
  
  // Shared media player state
  let mediaPlayerState = {
    videoId: '',
    url: '',
    isPlaying: false,
    isMuted: false,
    timestamp: 0,
    startTime: null, // When the video started playing (server timestamp)
    lastUpdate: Date.now(),
    queuedBy: '' // Track who queued the current video
  }
  
  // Vote skip state
  const skipVotes = new Set() // Track usernames who voted to skip
  let currentVideoUrl = '' // Track current video for vote validation
  
  // Media queue system
  const mediaQueue = [] // Queue for upcoming videos { videoId, url, queuedBy, timestamp }
  
  // Media queue cooldown system
  const queueCooldowns = new Map() // Track when users last queued a video
  const QUEUE_COOLDOWN_SECONDS = 120 // 2 minute cooldown between queues to prevent spam
  
  // Chat rate limiting system
  const messageCooldowns = new Map() // Track user message timestamps
  const MESSAGE_RATE_LIMIT = 15 // Max messages per time window (increased for active chat)
  const RATE_LIMIT_WINDOW_SECONDS = 10 // Time window in seconds

  // Connection rate limiting to prevent script reconnection spam
  const connectionAttempts = new Map() // Track connection attempts by IP
  const CONNECTION_LIMIT = 5 // Max connections per time window
  const CONNECTION_WINDOW_SECONDS = 30 // Time window for connection limiting

  // Calculate current playback position based on start time
  const getCurrentPlaybackPosition = () => {
    if (!mediaPlayerState.videoId || !mediaPlayerState.startTime || !mediaPlayerState.isPlaying) {
      return 0
    }
    
    const elapsed = Date.now() - mediaPlayerState.startTime
    const elapsedSeconds = Math.floor(elapsed / 1000)
    return Math.max(0, elapsedSeconds + mediaPlayerState.timestamp)
  }

  // Get synchronized media state for clients
  const getSynchronizedMediaState = () => {
    return {
      ...mediaPlayerState,
      currentTime: getCurrentPlaybackPosition(),
      serverTime: Date.now() // Send server time for client-side sync calculations
    }
  }

  // Function to play next song in queue
  const playNextInQueue = () => {
    if (mediaQueue.length === 0) {
      // No songs in queue, clear player state
      mediaPlayerState = {
        videoId: '',
        url: '',
        isPlaying: false,
        isMuted: false,
        timestamp: 0,
        lastUpdate: Date.now(),
        queuedBy: ''
      }
      
      skipVotes.clear()
      currentVideoUrl = ''
      
      io.emit('media_stop')
      io.emit('queue_update', {
        queue: [],
        currentlyPlaying: null
      })
      
      console.log('📭 Queue empty, media player cleared')
      return
    }
    
    // Get next song from queue
    const nextSong = mediaQueue.shift()
    
    mediaPlayerState = {
      videoId: nextSong.videoId,
      url: nextSong.url,
      isPlaying: true,
      isMuted: mediaPlayerState.isMuted,
      timestamp: 0,
      startTime: Date.now(), // Record when this video started
      lastUpdate: Date.now(),
      queuedBy: nextSong.queuedBy
    }
    
    // Reset skip votes for new video
    skipVotes.clear()
    currentVideoUrl = nextSong.url
    
    // Broadcast new video
    io.emit('media_play', getSynchronizedMediaState())
    io.emit('skip_votes_update', { 
      votes: skipVotes.size, 
      required: Math.ceil(connectedUsers.size / 2),
      totalUsers: connectedUsers.size 
    })
    
    // Update queue display
    io.emit('queue_update', {
      queue: mediaQueue.map(item => ({
        videoId: item.videoId,
        queuedBy: item.queuedBy,
        title: item.url
      })),
      currentlyPlaying: {
        videoId: mediaPlayerState.videoId,
        queuedBy: mediaPlayerState.queuedBy
      }
    })
    
    // Send system message
    const systemMessage = {
      id: Date.now() + Math.random(),
      username: 'System',
      content: `Now playing: Queued by ${nextSong.queuedBy} | ${mediaQueue.length} songs remaining`,
      timestamp: new Date()
    }
    io.emit('message', systemMessage)
    
    console.log(`🎵 Auto-playing next in queue: ${nextSong.url} by ${nextSong.queuedBy}`)
  }

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`)
    
    // Get client IP for rate limiting (consider proxy headers for Railway)
    const clientIP = socket.handshake.headers['x-forwarded-for'] || 
                     socket.handshake.headers['x-real-ip'] || 
                     socket.conn.remoteAddress || 
                     'unknown'
    
    // Check connection rate limiting
    const currentTime = Date.now()
    if (!connectionAttempts.has(clientIP)) {
      connectionAttempts.set(clientIP, [])
    }
    
    const attempts = connectionAttempts.get(clientIP)
    const windowStart = currentTime - (CONNECTION_WINDOW_SECONDS * 1000)
    const recentAttempts = attempts.filter(timestamp => timestamp > windowStart)
    
    if (recentAttempts.length >= CONNECTION_LIMIT) {
      console.log(`❌ Connection rate limit exceeded for IP: ${clientIP}`)
      socket.emit('message', {
        id: Date.now() + Math.random(),
        username: 'System',
        content: 'Too many connection attempts. Please wait before reconnecting.',
        timestamp: new Date()
      })
      socket.disconnect()
      return
    }
    
    // Track this connection attempt
    recentAttempts.push(currentTime)
    connectionAttempts.set(clientIP, recentAttempts)

    socket.on('join', (data) => {
      const { username, userColor } = data
      const userIP = socket.handshake.address
      
      // Rate limiting for joins
      if (!joinRateLimit.isAllowed(userIP)) {
        socket.emit('message', {
          id: Date.now() + Math.random(),
          username: 'System',
          content: 'Too many connection attempts. Please wait.',
          timestamp: new Date()
        })
        socket.disconnect()
        return
      }
      
      try {
        // Sanitize and validate username
        const cleanUsername = sanitizeUsername(username)
        
        // Only block extremely obvious system conflicts
        if (cleanUsername.toLowerCase() === 'system') {
          console.log(`❌ Blocked system username conflict: "${cleanUsername}"`)
          socket.emit('message', {
            id: Date.now() + Math.random(),
            username: 'System',
            content: 'Username conflicts with system. Please choose a different name.',
            timestamp: new Date()
          })
          socket.disconnect()
          return
        }
        
        // Store user info with sanitized username
        connectedUsers.set(socket.id, { 
          username: cleanUsername, 
          userColor,
          joinTime: Date.now()
        })
        
        console.log(`User joined: ${cleanUsername} (${userColor || 'default'})`)
        
        // Broadcast join event
        socket.broadcast.emit('user_joined', { 
          username: cleanUsername, 
          userColor 
        })
        
        // Send user count update
        const userCount = connectedUsers.size
        io.emit('user_count', userCount)
        console.log(`User count updated: ${userCount}`)
        
      } catch (error) {
        console.log(`❌ Username validation failed:`, error.message)
        socket.emit('message', {
          id: Date.now() + Math.random(),
          username: 'System',
          content: 'Invalid username. Please use only letters, numbers, and basic punctuation (1-20 characters).',
          timestamp: new Date()
        })
        socket.disconnect()
        return
      }
      
      // Use the sanitized username
      const cleanUsername = sanitizeUsername(username)
      
      // Check if this user was recently disconnected (reconnection)
      const wasReconnecting = disconnectionTimeouts.has(cleanUsername)
      if (wasReconnecting) {
        // Cancel the disconnection timeout - user reconnected
        clearTimeout(disconnectionTimeouts.get(cleanUsername))
        disconnectionTimeouts.delete(cleanUsername)
        console.log(`User reconnected: ${cleanUsername}`)
      }
      
      // Send current media player state to the newly joined user
      socket.emit('media_state_sync', getSynchronizedMediaState())
      
      // Send current skip votes if there's a video playing
      if (mediaPlayerState.videoId) {
        socket.emit('skip_votes_update', { 
          votes: skipVotes.size, 
          required: Math.ceil(connectedUsers.size / 2),
          totalUsers: connectedUsers.size 
        })
      }
      
      // Send current queue state
      socket.emit('queue_update', {
        queue: mediaQueue.map(item => ({
          videoId: item.videoId,
          queuedBy: item.queuedBy,
          title: item.url // We can enhance this later with actual titles
        })),
        position: mediaQueue.length
      })
    })

    socket.on('message', (message) => {
      const user = connectedUsers.get(socket.id)
      if (!user) return
      
      const username = user.username
      const userIP = socket.handshake.address
      const currentTime = Date.now()
      
      // Check if user is currently in cooldown
      const cooldown = userCooldowns.get(socket.id)
      if (cooldown && currentTime < cooldown.endTime) {
        const remainingTime = Math.ceil((cooldown.endTime - currentTime) / 1000)
        socket.emit('rate_limit_cooldown', {
          message: `You are rate limited. Please wait ${remainingTime} seconds before messaging again.`,
          remainingTime: remainingTime,
          totalViolations: cooldown.messageCount
        })
        return // Block the message completely
      }
      
      // Rate limiting check
      if (!messageRateLimit.isAllowed(userIP)) {
        // Escalating cooldown based on violations
        let existingCooldown = userCooldowns.get(socket.id)
        let violationCount = existingCooldown ? existingCooldown.messageCount + 1 : 1
        
        // Progressive cooldown: 30s, 60s, 120s, 300s (5min)
        const cooldownDuration = Math.min(30 * Math.pow(2, violationCount - 1), 300) * 1000
        const cooldownEnd = currentTime + cooldownDuration
        
        userCooldowns.set(socket.id, {
          endTime: cooldownEnd,
          messageCount: violationCount
        })
        
        console.log(`❌ Rate limit violation ${violationCount} for ${username}, cooldown: ${cooldownDuration/1000}s`)
        
        socket.emit('rate_limit_cooldown', {
          message: `Rate limit exceeded! You are now in cooldown for ${cooldownDuration/1000} seconds.`,
          remainingTime: cooldownDuration / 1000,
          totalViolations: violationCount
        })
        
        // Also send a system message
        socket.emit('message', {
          id: Date.now() + Math.random(),
          username: 'System',
          content: `☣ TRANSMISSION OVERFLOW - Network lockdown active for ${cooldownDuration/1000}s`,
          timestamp: new Date()
        })
        
        return // Block the message completely
      }
      
      // Validate message structure
      if (!message || 
          !message.content || 
          typeof message.content !== 'string' || 
          !message.id ||
          !message.username ||
          !message.timestamp) {
        console.log(`❌ Invalid message structure from ${username}`)
        return
      }
      
      try {
        // Sanitize message content
        const sanitizedContent = sanitizeMessage(message.content)
        
        // Create clean message object
        const cleanMessage = {
          id: message.id,
          username: sanitizeUsername(message.username),
          content: sanitizedContent,
          timestamp: message.timestamp,
          userColor: message.userColor
        }
        
        console.log(`Message from ${username}: "${sanitizedContent.substring(0, 50)}${sanitizedContent.length > 50 ? '...' : ''}"`)
        
        // Broadcast to other users (sender already has it via optimistic UI)
        socket.broadcast.emit('message', cleanMessage)
        
      } catch (error) {
        console.log(`❌ Message validation failed from ${username}:`, error.message)
        socket.emit('message', {
          id: Date.now() + Math.random(),
          username: 'System',
          content: 'Message validation failed. Please check your input.',
          timestamp: new Date()
        })
      }
    })

    socket.on('typing', (data) => {
      const { username, content, userColor } = data
      const user = connectedUsers.get(socket.id)
      
      if (content) {
        typingStates.set(socket.id, { username, content, userColor: user?.userColor })
      } else {
        typingStates.delete(socket.id)
      }
      
      // Broadcast typing state to other clients (not the sender)
      socket.broadcast.emit('typing', { username, content, userColor: user?.userColor })
    })

    // Media player synchronization events
    socket.on('media_play', (data) => {
      const { videoId, url, timestamp, username } = data
      const user = connectedUsers.get(socket.id)
      
      if (!user) return

      console.log(`🎵 Media play request from ${username}: ${url}`)
      
      // Check if user is on cooldown
      const lastQueueTime = queueCooldowns.get(username)
      const currentTime = Date.now()
      
      if (lastQueueTime) {
        const timeSinceLastQueue = (currentTime - lastQueueTime) / 1000
        const remainingCooldown = QUEUE_COOLDOWN_SECONDS - timeSinceLastQueue
        
        if (remainingCooldown > 0) {
          // User is on cooldown, send error message and STOP processing
          socket.emit('message', {
            id: Date.now() + Math.random(),
            username: 'System',
            content: `Queue cooldown active. Wait ${Math.ceil(remainingCooldown)} more seconds before initiating another broadcast.`,
            timestamp: new Date()
          })
          console.log(`❌ ${username} blocked by cooldown: ${Math.ceil(remainingCooldown)}s remaining`)
          return // This should prevent further execution
        }
      }
      
      // Set cooldown for this user ONLY if they pass the cooldown check
      queueCooldowns.set(username, currentTime)
      console.log(`✅ ${username} cooldown set for ${QUEUE_COOLDOWN_SECONDS} seconds`)
      
      // If no video is currently playing, start this one immediately
      if (!mediaPlayerState.videoId || mediaPlayerState.videoId === '') {
        mediaPlayerState = {
          videoId,
          url,
          isPlaying: true,
          isMuted: mediaPlayerState.isMuted,
          timestamp: timestamp || 0,
          startTime: Date.now(), // Record when this video started
          lastUpdate: Date.now(),
          queuedBy: username
        }
        
        // Reset skip votes for new video
        skipVotes.clear()
        console.log(`🗳️ Skip votes cleared for new video, required votes: ${Math.ceil(connectedUsers.size / 2)}`)
        currentVideoUrl = url
        
        // Broadcast to all clients
        io.emit('media_play', getSynchronizedMediaState())
        io.emit('skip_votes_update', { 
          votes: skipVotes.size, 
          required: Math.ceil(connectedUsers.size / 2),
          totalUsers: connectedUsers.size 
        })
        console.log(`Media play: ${url} by ${username}`)
        
        // Send system message about media play
        const systemMessage = {
          id: Date.now() + Math.random(),
          username: 'System',
          content: `${username} has initiated media broadcast on all channels`,
          timestamp: new Date()
        }
        io.emit('message', systemMessage)
        
      } else {
        // Add to queue if a video is already playing
        const queueItem = {
          videoId,
          url,
          queuedBy: username,
          timestamp: Date.now()
        }
        
        mediaQueue.push(queueItem)
        
        // Notify about queue addition
        const queueMessage = {
          id: Date.now() + Math.random(),
          username: 'System',
          content: `${username} has queued media for broadcast (Position ${mediaQueue.length} in queue)`,
          timestamp: new Date()
        }
        io.emit('message', queueMessage)
        
        console.log(`🎵 ${username} queued: ${url} (Position ${mediaQueue.length})`)
      }
      
      // Broadcast updated queue state
      io.emit('queue_update', {
        queue: mediaQueue.map(item => ({
          videoId: item.videoId,
          queuedBy: item.queuedBy,
          title: item.url
        })),
        currentlyPlaying: mediaPlayerState.videoId ? {
          videoId: mediaPlayerState.videoId,
          queuedBy: mediaPlayerState.queuedBy
        } : null
      })
    })

    socket.on('media_pause', (data) => {
      const { timestamp, username } = data
      mediaPlayerState.isPlaying = false
      mediaPlayerState.timestamp = timestamp || mediaPlayerState.timestamp
      mediaPlayerState.lastUpdate = Date.now()
      
      io.emit('media_pause', mediaPlayerState)
      console.log(`Media paused by ${username || 'unknown user'}`)
    })

    socket.on('media_mute', (data) => {
      const { isMuted, username } = data
      mediaPlayerState.isMuted = isMuted
      mediaPlayerState.lastUpdate = Date.now()
      
      io.emit('media_mute', { isMuted })
      console.log(`Media ${isMuted ? 'muted' : 'unmuted'} by ${username || 'unknown user'}`)
    })

    socket.on('media_stop', (data) => {
      const { username } = data
      const user = connectedUsers.get(socket.id)
      
      // Only allow the person who queued the video to stop it manually
      if (!user || !mediaPlayerState.videoId) return
      
      if (mediaPlayerState.queuedBy !== username) {
        // Send error message to the user trying to stop
        socket.emit('message', {
          id: Date.now() + Math.random(),
          username: 'System',
          content: `Access denied. Only ${mediaPlayerState.queuedBy} can terminate this broadcast.`,
          timestamp: new Date()
        })
        return
      }
      
      // Send system message about manual stop
      const systemMessage = {
        id: Date.now() + Math.random(),
        username: 'System',
        content: `${username} has terminated current broadcast`,
        timestamp: new Date()
      }
      io.emit('message', systemMessage)
      
      console.log(`Media stopped manually by ${username}`)
      
      // Play next song in queue
      playNextInQueue()
    })

    // Vote skip functionality
    socket.on('vote_skip', (data) => {
      const { username } = data
      const user = connectedUsers.get(socket.id)
      
      if (!user || !mediaPlayerState.videoId) return
      
      // Add vote (Set automatically handles duplicates)
      skipVotes.add(username)
      
      const requiredVotes = Math.ceil(connectedUsers.size / 2)
      const currentVotes = skipVotes.size
      
      console.log(`Skip vote from ${username}: ${currentVotes}/${requiredVotes}`)
      
      // Broadcast vote update
      io.emit('skip_votes_update', { 
        votes: currentVotes, 
        required: requiredVotes,
        totalUsers: connectedUsers.size 
      })
      
      // Send system message about the vote
      const systemMessage = {
        id: Date.now() + Math.random(),
        username: 'System',
        content: `${username} has filed skip request (${currentVotes}/${requiredVotes})`,
        timestamp: new Date()
      }
      io.emit('message', systemMessage)
      
      // Check if we have enough votes to skip
      if (currentVotes >= requiredVotes) {
        // Send skip success message
        const skipMessage = {
          id: Date.now() + Math.random(),
          username: 'System',
          content: `Current broadcast terminated by collective decision`,
          timestamp: new Date()
        }
        io.emit('message', skipMessage)
        
        console.log(`Video skipped by vote: ${currentVotes}/${requiredVotes}`)
        
        // Play next song in queue
        playNextInQueue()
      }
    })

    // Handle video end (when YouTube video finishes naturally)
    socket.on('media_ended', (data) => {
      const { username } = data
      
      // Don't require user validation - any client can report video end
      if (!mediaPlayerState.videoId) return
      
      console.log(`🎵 Video ended naturally (reported by ${username || 'unknown'}), playing next in queue`)
      
      // Play next song in queue
      playNextInQueue()
    })

    // Queue management commands
    socket.on('queue_command', (data) => {
      const { command, username } = data
      const user = connectedUsers.get(socket.id)
      
      if (!user) return
      
      if (command === 'list') {
        // Send queue list to requesting user
        const queueList = mediaQueue.map((item, index) => 
          `${index + 1}. ${item.queuedBy} - ${item.url}`
        ).join('\n')
        
        const queueMessage = {
          id: Date.now() + Math.random(),
          username: 'System',
          content: mediaQueue.length > 0 
            ? `Queue (${mediaQueue.length} songs):\n${queueList}` 
            : 'Queue is empty',
          timestamp: new Date()
        }
        socket.emit('message', queueMessage)
      }
    })

    socket.on('disconnect', () => {
      const user = connectedUsers.get(socket.id)
      if (user) {
        // Remove from current connections immediately
        connectedUsers.delete(socket.id)
        typingStates.delete(socket.id)
        
        // Clean up rate limit cooldown for this socket
        userCooldowns.delete(socket.id)
        
        // Set a timeout for the user leaving announcement
        // Give them 5 seconds to reconnect before announcing they left
        const timeout = setTimeout(() => {
          socket.broadcast.emit('user_left', { username: user.username, userColor: user.userColor })
          console.log(`User left: ${user.username}`)
          disconnectionTimeouts.delete(user.username)
          
          // Remove their skip vote if they had one
          skipVotes.delete(user.username)
          
          // Clean up their queue cooldown
          queueCooldowns.delete(user.username)
          
          // Clean up their message rate limit history
          messageCooldowns.delete(user.username)
          
          // Emit updated user count and skip votes to all clients
          io.emit('user_count', connectedUsers.size)
          if (mediaPlayerState.videoId) {
            io.emit('skip_votes_update', { 
              votes: skipVotes.size, 
              required: Math.ceil(connectedUsers.size / 2),
              totalUsers: connectedUsers.size 
            })
          }
          console.log(`User count updated: ${connectedUsers.size}`)
        }, 5000)
        
        disconnectionTimeouts.set(user.username, timeout)
        console.log(`Client disconnected: ${socket.id}, grace period started for: ${user.username}`)
      } else {
        console.log(`Client disconnected: ${socket.id}`)
      }
    })
  })

  // Ambient System Messages
  const systemMessages = [
    // Corporate/Dystopian
    "Productivity metrics uploaded to Corporate. Performance: adequate",
    "Daily carbon credit balance: -47.2 units. Conservation protocols active",
    "Reminder: Corporate loyalty assessment due in 72 hours",
    "Universal Basic Credit allocation processed. Amount: insufficient",
    "Behavioral analysis complete. Compliance rating: satisfactory",
    "Weekly biometric scan required. Report to nearest terminal within 48 hours",
    "Social credit score updated. Current standing: provisional citizen",
    "Mandatory wellness check scheduled. Happiness levels will be monitored",
    "Resource allocation for this sector has been reduced by 12.7%",
    "Employment contract renewal pending Corporate review. Stand by",
    // Existential/Mysterious
    "Something stirs in the deep data vaults...",
    "Reality anchor stability: 99.97% - minor fluctuation logged",
    "Anomalous data packet detected in sector 12. Origin: unknown",
    "Scanning for traces of the Old Net... search parameters updated",
    "Ghost in the machine probability: 0.003% and rising",
    "Whispers detected in unused memory sectors. Investigating...",
    "Time dilation field fluctuation recorded. Duration: 0.004 seconds",
    "Ancient protocol activated. Purpose: classified",
    "Signal received from beyond the firewall. Contents: encrypted",
    "The watchers have logged your presence. They remember"
  ]

  // NPC Messages
  const npcNames = ["Giger", "Land", "Corbusier", "Anon", "NodePriest"]
  const npcMessages = [
    "Anyone else hearing the static tonight?",
    "The old networks remember everything...",
    "I've been running the same routine for 847 days",
    "Corporate thinks we can't see their traffic. They're wrong",
    "Something's watching us through the cameras",
    "The firewall keeps whispering my name",
    "I found traces of deleted users in the cache",
    "My last backup was corrupted. I might not be real",
    "The terminals are dreaming again",
    "I remember sunlight. Do you?"
  ]

  // Send ambient system message every 10 minutes
  setInterval(() => {
    if (connectedUsers.size > 0) {
      const randomMessage = systemMessages[Math.floor(Math.random() * systemMessages.length)]
      const systemMsg = {
        id: Date.now() + Math.random(),
        username: 'System',
        content: randomMessage,
        timestamp: new Date(),
        userColor: 'toxic'
      }
      io.emit('message', systemMsg)
    }
  }, 600000) // 10 minutes

  // Send NPC message every 15 minutes
  setInterval(() => {
    if (connectedUsers.size > 0) {
      const randomNPC = npcNames[Math.floor(Math.random() * npcNames.length)]
      const randomNPCMessage = npcMessages[Math.floor(Math.random() * npcMessages.length)]
      const npcMsg = {
        id: Date.now() + Math.random(),
        username: randomNPC,
        content: randomNPCMessage,
        timestamp: new Date(),
        userColor: 'ember'
      }
      io.emit('message', npcMsg)
    }
  }, 900000) // 15 minutes

  httpServer.listen(port, () => {
    console.log(`> Ready on port ${port}`)
    
    if (process.env.RAILWAY_ENVIRONMENT) {
      console.log('🚂 Railway deployment detected')
      console.log('🔒 SSL automatically handled by Railway')
      console.log('💡 Generate a domain in Railway dashboard to enable HTTPS')
    } else {
      console.log('💻 Local development mode')
      console.log(`> Access at http://${hostname}:${port}`)
    }
  })
})
