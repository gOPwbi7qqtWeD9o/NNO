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

function sanitizeUsername(username, isAdmin = false) {
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
    'sys', 'sysadmin', 'support', 'help', 'service', 'neuralnode'
  ]
  
  // Admin bypass for NeuralNode
  if (isAdmin && lowerClean === 'neuralnode') {
    return clean
  }
  
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

// Advanced bot detection functions
function calculateStringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0
  
  // Normalize strings (remove spaces, convert to lowercase)
  const s1 = str1.toLowerCase().replace(/\s+/g, '')
  const s2 = str2.toLowerCase().replace(/\s+/g, '')
  
  if (s1 === s2) return 1
  if (s1.length === 0 || s2.length === 0) return 0
  
  // Calculate Levenshtein distance
  const matrix = Array(s1.length + 1).fill().map(() => Array(s2.length + 1).fill(0))
  
  for (let i = 0; i <= s1.length; i++) matrix[i][0] = i
  for (let j = 0; j <= s2.length; j++) matrix[0][j] = j
  
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,     // deletion
        matrix[i][j - 1] + 1,     // insertion
        matrix[i - 1][j - 1] + cost // substitution
      )
    }
  }
  
  const maxLength = Math.max(s1.length, s2.length)
  return 1 - (matrix[s1.length][s2.length] / maxLength)
}

function detectScrollingPattern(contents) {
  if (contents.length < 3) return false
  
  // Check for scrolling/shifting patterns
  for (let i = 0; i < contents.length - 2; i++) {
    const str1 = contents[i]
    const str2 = contents[i + 1]
    const str3 = contents[i + 2]
    
    // Check if content is shifting (common in scrolling text bots)
    if (str1.length > 3 && str2.length > 3 && str3.length > 3) {
      // Look for substring patterns indicating scrolling
      if ((str1.includes(str2.substring(1)) && str2.includes(str3.substring(1))) ||
          (str2.includes(str1.substring(1)) && str3.includes(str2.substring(1)))) {
        return true
      }
    }
  }
  
  return false
}

function detectTypingRhythm(timestamps) {
  if (timestamps.length < 5) return { suspicious: false, score: 0 }
  
  // Calculate intervals between typing events
  const intervals = []
  for (let i = 1; i < timestamps.length; i++) {
    intervals.push(timestamps[i] - timestamps[i - 1])
  }
  
  // Check for too-consistent intervals (bot behavior)
  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
  let consistentIntervals = 0
  
  intervals.forEach(interval => {
    if (Math.abs(interval - avgInterval) < 50) { // Within 50ms = very consistent
      consistentIntervals++
    }
  })
  
  const consistencyRatio = consistentIntervals / intervals.length
  
  return {
    suspicious: consistencyRatio > 0.8 && avgInterval < 200, // 80% consistent + very fast
    score: consistencyRatio > 0.8 ? 15 : (consistencyRatio > 0.6 ? 5 : 0)
  }
}

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
    allowEIO3: true,
    // Add connection stability settings
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    maxHttpBufferSize: 1e6
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
  const MESSAGE_RATE_LIMIT = 8 // Max messages per time window (reduced for spam prevention)
  const RATE_LIMIT_WINDOW_SECONDS = 10 // Time window in seconds
  
  // Enhanced spam detection
  const userSpamMetrics = new Map() // Track character counts and repeated content
  const ipSpamMetrics = new Map() // Track spam metrics by IP address
  const ipCooldowns = new Map() // Track IP-based cooldowns that persist after disconnect
  const bannedIPs = new Set() // Permanently banned IP addresses
  const MAX_CHARS_PER_WINDOW = 500 // Max characters per time window
  const SPAM_WINDOW_SECONDS = 30 // Time window for spam detection
  const REPEATED_CONTENT_THRESHOLD = 3 // How many times same content triggers spam
  
  // Typing spam detection
  const typingSpamMetrics = new Map() // Track typing events by IP
  const TYPING_RATE_LIMIT = 50 // Max typing events per window (increased)
  const TYPING_WINDOW_SECONDS = 10 // Time window for typing rate limit
  
  // Advanced bot detection
  const botDetectionMetrics = new Map() // Track sophisticated bot patterns by IP
  const SIMILARITY_THRESHOLD = 0.7 // How similar content needs to be to flag as bot
  const PATTERN_WINDOW_SECONDS = 120 // 2 minute window for pattern analysis
  const BOT_SCORE_THRESHOLD = 50 // Cumulative bot score before action
  
  // Typing timeout system
  const TYPING_TIMEOUT_MS = 60000 // 1 minute timeout
  const TYPING_CLEANUP_INTERVAL = 30000 // Check every 30 seconds

  // Connection rate limiting to prevent script reconnection spam (more lenient)
  const connectionAttempts = new Map() // Track connection attempts by IP
  const CONNECTION_LIMIT = 8 // Max connections per time window (increased from 5)
  const CONNECTION_WINDOW_SECONDS = 60 // Time window for connection limiting (increased from 30)

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
    
    const currentTime = Date.now()
    
    // Check if IP is permanently banned
    if (bannedIPs.has(clientIP)) {
      console.log(`❌ IP ${clientIP} is permanently banned`)
      socket.emit('message', {
        id: Date.now() + Math.random(),
        username: 'System',
        content: `Access denied. IP address is permanently banned.`,
        timestamp: new Date()
      })
      setTimeout(() => socket.disconnect(), 500)
      return
    }
    
    // Check if IP is under spam cooldown
    const ipCooldown = ipCooldowns.get(clientIP)
    if (ipCooldown && currentTime < ipCooldown.endTime) {
      const remainingTime = Math.ceil((ipCooldown.endTime - currentTime) / 1000)
      console.log(`❌ IP ${clientIP} blocked due to spam cooldown: ${remainingTime}s remaining`)
      socket.emit('message', {
        id: Date.now() + Math.random(),
        username: 'System',
        content: `Access denied. IP under spam protection cooldown for ${remainingTime} more seconds.`,
        timestamp: new Date()
      })
      setTimeout(() => socket.disconnect(), 500)
      return
    }
    
    // Check connection rate limiting
    if (!connectionAttempts.has(clientIP)) {
      connectionAttempts.set(clientIP, [])
    }
    
    const attempts = connectionAttempts.get(clientIP)
    const windowStart = currentTime - (CONNECTION_WINDOW_SECONDS * 1000)
    const recentAttempts = attempts.filter(timestamp => timestamp > windowStart)
    
    if (recentAttempts.length >= CONNECTION_LIMIT) {
      console.log(`❌ Connection rate limit exceeded for IP: ${clientIP} (${recentAttempts.length}/${CONNECTION_LIMIT} in ${CONNECTION_WINDOW_SECONDS}s)`)
      socket.emit('message', {
        id: Date.now() + Math.random(),
        username: 'System',
        content: `Connection frequency exceeded. Please wait ${Math.ceil(CONNECTION_WINDOW_SECONDS/2)} seconds before reconnecting.`,
        timestamp: new Date()
      })
      // Add a small delay before disconnect to ensure message is sent
      setTimeout(() => socket.disconnect(), 500)
      return
    }
    
    // Track this connection attempt
    recentAttempts.push(currentTime)
    connectionAttempts.set(clientIP, recentAttempts)

    socket.on('join', (data) => {
      const { username, userColor, adminKey } = data
      const userIP = socket.handshake.address
      
      // Check if admin authentication
      const isAdmin = adminKey === process.env.ADMIN_KEY
      
      // Rate limiting for joins (less aggressive)
      if (!joinRateLimit.isAllowed(userIP)) {
        socket.emit('message', {
          id: Date.now() + Math.random(),
          username: 'System',
          content: 'Join attempts too frequent. Please wait a moment.',
          timestamp: new Date()
        })
        setTimeout(() => socket.disconnect(), 1000) // Give more time for message delivery
        return
      }
      
      try {
        // Sanitize and validate username
        const cleanUsername = sanitizeUsername(username, isAdmin)
        
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
          joinTime: Date.now(),
          isAdmin: isAdmin,
          ipAddress: clientIP
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
      
      // Enhanced spam detection - check before rate limiting
      if (message && message.content && typeof message.content === 'string') {
        const messageContent = message.content.trim()
        const messageLength = messageContent.length
        
        // Get or create spam metrics for this user
        let spamMetrics = userSpamMetrics.get(username)
        if (!spamMetrics) {
          spamMetrics = {
            messages: [],
            contentHistory: [],
            totalChars: 0,
            lastWindowReset: currentTime
          }
          userSpamMetrics.set(username, spamMetrics)
        }
        
        // Also track by IP to prevent rejoin spam
        let ipSpamData = ipSpamMetrics.get(userIP)
        if (!ipSpamData) {
          ipSpamData = {
            messages: [],
            contentHistory: [],
            totalChars: 0
          }
          ipSpamMetrics.set(userIP, ipSpamData)
        }
        
        // Clean old messages outside the spam window for both user and IP
        const spamWindowStart = currentTime - (SPAM_WINDOW_SECONDS * 1000)
        spamMetrics.messages = spamMetrics.messages.filter(msg => msg.timestamp > spamWindowStart)
        spamMetrics.contentHistory = spamMetrics.contentHistory.filter(content => content.timestamp > spamWindowStart)
        ipSpamData.messages = ipSpamData.messages.filter(msg => msg.timestamp > spamWindowStart)
        ipSpamData.contentHistory = ipSpamData.contentHistory.filter(content => content.timestamp > spamWindowStart)
        
        // Recalculate total characters in current window for both user and IP
        spamMetrics.totalChars = spamMetrics.messages.reduce((sum, msg) => sum + msg.length, 0)
        ipSpamData.totalChars = ipSpamData.messages.reduce((sum, msg) => sum + msg.length, 0)
        
        // Check character spam (check both user and IP limits)
        const userCharLimit = spamMetrics.totalChars + messageLength > MAX_CHARS_PER_WINDOW
        const ipCharLimit = ipSpamData.totalChars + messageLength > MAX_CHARS_PER_WINDOW
        
        if (userCharLimit || ipCharLimit) {
          console.log(`❌ Character spam detected from ${username} (IP: ${userIP}): user=${spamMetrics.totalChars + messageLength}/${MAX_CHARS_PER_WINDOW}, ip=${ipSpamData.totalChars + messageLength}/${MAX_CHARS_PER_WINDOW}`)
          
          const cooldownDuration = 300 * 1000 // 5 minute cooldown for character spam
          
          // Set cooldown for both socket and IP
          userCooldowns.set(socket.id, {
            endTime: currentTime + cooldownDuration,
            messageCount: 1
          })
          
          ipCooldowns.set(userIP, {
            endTime: currentTime + cooldownDuration,
            reason: 'character_spam'
          })
          
          socket.emit('rate_limit_cooldown', {
            message: `Character spam detected! IP cooldown active for 300 seconds.`,
            remainingTime: 300,
            totalViolations: 1
          })
          
          socket.emit('message', {
            id: Date.now() + Math.random(),
            username: 'System',
            content: `⚠ SPAM FILTER TRIGGERED - Excessive character transmission detected. IP blocked.`,
            timestamp: new Date()
          })
          
          return
        }
        
        // Check repeated content spam (check both user and IP)
        const userRepeatedContent = spamMetrics.contentHistory.filter(content => 
          content.text.toLowerCase() === messageContent.toLowerCase()
        ).length
        
        const ipRepeatedContent = ipSpamData.contentHistory.filter(content => 
          content.text.toLowerCase() === messageContent.toLowerCase()
        ).length
        
        if (userRepeatedContent >= REPEATED_CONTENT_THRESHOLD || ipRepeatedContent >= REPEATED_CONTENT_THRESHOLD) {
          console.log(`❌ Repeated content spam detected from ${username} (IP: ${userIP}): "${messageContent.substring(0, 50)}..." user=${userRepeatedContent}, ip=${ipRepeatedContent}`)
          
          const cooldownDuration = 600 * 1000 // 10 minute cooldown for repeated content spam
          
          // Set cooldown for both socket and IP
          userCooldowns.set(socket.id, {
            endTime: currentTime + cooldownDuration,
            messageCount: 1
          })
          
          ipCooldowns.set(userIP, {
            endTime: currentTime + cooldownDuration,
            reason: 'repeated_content_spam'
          })
          
          socket.emit('rate_limit_cooldown', {
            message: `Repeated content spam detected! IP cooldown active for 600 seconds.`,
            remainingTime: 600,
            totalViolations: 1
          })
          
          socket.emit('message', {
            id: Date.now() + Math.random(),
            username: 'System',
            content: `⚠ SPAM FILTER TRIGGERED - Repeated transmission pattern detected. IP blocked.`,
            timestamp: new Date()
          })
          
          return
        }
        
        // Add this message to spam metrics for both user and IP
        spamMetrics.messages.push({ length: messageLength, timestamp: currentTime })
        spamMetrics.contentHistory.push({ text: messageContent, timestamp: currentTime })
        spamMetrics.totalChars += messageLength
        
        ipSpamData.messages.push({ length: messageLength, timestamp: currentTime })
        ipSpamData.contentHistory.push({ text: messageContent, timestamp: currentTime })
        ipSpamData.totalChars += messageLength
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
        
        // Create clean message object using stored user info
        const user = connectedUsers.get(socket.id)
        const cleanMessage = {
          id: message.id,
          username: user?.username || sanitizeUsername(message.username, user?.isAdmin || false),
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
      if (!user) return
      
      const currentTime = Date.now()
      
      // Get client IP for rate limiting
      const userIP = socket.handshake.headers['x-forwarded-for'] || 
                     socket.handshake.headers['x-real-ip'] || 
                     socket.conn.remoteAddress || 
                     'unknown'
      
      // Track typing spam by IP
      let typingData = typingSpamMetrics.get(userIP)
      if (!typingData) {
        typingData = { events: [], lastWarning: 0 }
        typingSpamMetrics.set(userIP, typingData)
      }
      
      // Track advanced bot patterns by IP
      let botData = botDetectionMetrics.get(userIP)
      if (!botData) {
        botData = { 
          contents: [], 
          timestamps: [], 
          botScore: 0, 
          lastBotCheck: 0,
          warnings: 0
        }
        botDetectionMetrics.set(userIP, botData)
      }
      
      // Clean old data outside windows
      const typingWindowStart = currentTime - (TYPING_WINDOW_SECONDS * 1000)
      const patternWindowStart = currentTime - (PATTERN_WINDOW_SECONDS * 1000)
      
      typingData.events = typingData.events.filter(event => event > typingWindowStart)
      botData.contents = botData.contents.filter((_, i) => botData.timestamps[i] > patternWindowStart)
      botData.timestamps = botData.timestamps.filter(ts => ts > patternWindowStart)
      
      // Add current data
      typingData.events.push(currentTime)
      if (content && content.length > 2) { // Only track substantial content
        botData.contents.push(content)
        botData.timestamps.push(currentTime)
      }
      
      // Check if exceeding typing rate limit (only apply severe penalties for extreme spam)
      if (typingData.events.length > TYPING_RATE_LIMIT * 3) { // 150+ events in 10s = bot behavior
        console.log(`❌ Extreme typing spam detected from IP ${userIP}: ${typingData.events.length} events`)
        
        const cooldownDuration = 120 * 1000 // 2 minute cooldown
        userCooldowns.set(socket.id, {
          endTime: currentTime + cooldownDuration,
          messageCount: 1
        })
        
        ipCooldowns.set(userIP, {
          endTime: currentTime + cooldownDuration,
          reason: 'typing_spam'
        })
        
        socket.emit('rate_limit_cooldown', {
          message: `Extreme typing spam detected! Cooldown active for 120 seconds.`,
          remainingTime: 120,
          totalViolations: 1
        })
        
        socket.emit('message', {
          id: Date.now() + Math.random(),
          username: 'System',
          content: `⚠ TYPING SPAM FILTER TRIGGERED - Extreme bot behavior detected`,
          timestamp: new Date()
        })
        
        console.log(`❌ Typing spam cooldown applied to IP ${userIP}`)
        return
      }
      
      // Warn for high typing frequency but still allow it
      if (typingData.events.length > TYPING_RATE_LIMIT && currentTime - typingData.lastWarning > 60000) {
        console.log(`⚠ High typing frequency from IP ${userIP}: ${typingData.events.length}/${TYPING_RATE_LIMIT} events`)
        
        socket.emit('message', {
          id: Date.now() + Math.random(),
          username: 'System',
          content: `⚠ High typing frequency detected. Please moderate your typing speed.`,
          timestamp: new Date()
        })
        
        typingData.lastWarning = currentTime
      }
      
      // Advanced bot detection algorithms
      if (content && botData.contents.length >= 3) {
        let currentBotScore = 0
        
        // 1. Content similarity detection for slight variations
        const recentContents = botData.contents.slice(-5) // Check last 5 messages
        for (let i = 0; i < recentContents.length - 1; i++) {
          for (let j = i + 1; j < recentContents.length; j++) {
            const similarity = calculateStringSimilarity(recentContents[i], recentContents[j])
            if (similarity > SIMILARITY_THRESHOLD) {
              currentBotScore += Math.floor(similarity * 10) // 7-10 points for similar content
            }
          }
        }
        
        // 2. Scrolling pattern detection
        if (detectScrollingPattern(botData.contents.slice(-10))) {
          currentBotScore += 20 // High score for scrolling patterns
          console.log(`🤖 Scrolling pattern detected from IP ${userIP}`)
        }
        
        // 3. Typing rhythm analysis
        const rhythmAnalysis = detectTypingRhythm(botData.timestamps.slice(-10))
        if (rhythmAnalysis.suspicious) {
          currentBotScore += rhythmAnalysis.score
          console.log(`🤖 Suspicious typing rhythm from IP ${userIP}, score: ${rhythmAnalysis.score}`)
        }
        
        // 4. Length consistency check (bots often have very consistent message lengths)
        if (botData.contents.length >= 5) {
          const lengths = botData.contents.slice(-5).map(c => c.length)
          const avgLength = lengths.reduce((a, b) => a + b, 0) / lengths.length
          let consistentLengths = 0
          
          lengths.forEach(len => {
            if (Math.abs(len - avgLength) <= 2) { // Within 2 characters = very consistent
              consistentLengths++
            }
          })
          
          if (consistentLengths >= 4) { // 4/5 messages same length
            currentBotScore += 10
          }
        }
        
        // Update cumulative bot score
        botData.botScore += currentBotScore
        
        // Progressive penalties based on bot score
        if (botData.botScore >= BOT_SCORE_THRESHOLD) {
          console.log(`🚫 Advanced bot detected from IP ${userIP}, total score: ${botData.botScore}`)
          
          // First offense: Temporary ban
          if (botData.warnings === 0) {
            const cooldownDuration = 300 * 1000 // 5 minute cooldown
            userCooldowns.set(socket.id, {
              endTime: currentTime + cooldownDuration,
              messageCount: 1
            })
            
            ipCooldowns.set(userIP, {
              endTime: currentTime + cooldownDuration,
              reason: 'advanced_bot_detection'
            })
            
            socket.emit('rate_limit_cooldown', {
              message: `Advanced bot behavior detected! Temporary ban for 5 minutes.`,
              remainingTime: 300,
              totalViolations: 1
            })
            
            botData.warnings = 1
            
            // Send admin notification
            const adminMsg = `🤖 ADVANCED BOT DETECTED: IP ${userIP}, Score: ${botData.botScore}, User: ${username} - 5min temp ban applied`
            sendAdminMessage(adminMsg)
            
          } else {
            // Repeat offense: Permanent IP ban
            bannedIPs.add(userIP)
            console.log(`🚫 Permanent ban applied to repeat bot offender IP: ${userIP}`)
            
            socket.emit('message', {
              id: Date.now() + Math.random(),
              username: 'System',
              content: `⛔ Connection terminated - Advanced bot behavior detected`,
              timestamp: new Date()
            })
            
            // Send admin notification
            const adminMsg = `🚫 PERMANENT BAN: IP ${userIP} banned for repeated advanced bot behavior. Score: ${botData.botScore}, User: ${username}`
            sendAdminMessage(adminMsg)
            
            socket.disconnect(true)
            return
          }
        } else if (botData.botScore >= BOT_SCORE_THRESHOLD * 0.7) {
          // Warning at 70% of threshold
          if (currentTime - botData.lastBotCheck > 60000) { // Only warn once per minute
            socket.emit('message', {
              id: Date.now() + Math.random(),
              username: 'System',
              content: `⚠ Suspicious activity detected. Please verify you are human.`,
              timestamp: new Date()
            })
            
            botData.lastBotCheck = currentTime
            console.log(`⚠ Bot warning sent to IP ${userIP}, score: ${botData.botScore}/${BOT_SCORE_THRESHOLD}`)
          }
        }
        
        // Decay bot score over time to allow for false positives
        if (currentTime - botData.lastBotCheck > 300000) { // Every 5 minutes
          botData.botScore = Math.max(0, botData.botScore - 5)
          botData.lastBotCheck = currentTime
        }
      }
      
      if (content) {
        typingStates.set(socket.id, { 
          username, 
          content, 
          userColor: user?.userColor,
          lastActivity: currentTime,
          socketId: socket.id
        })
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

    // Handle ping messages from clients to maintain connection
    socket.on('ping', (data) => {
      console.log(`Ping received from ${socket.id}`)
      socket.emit('pong', { timestamp: Date.now(), serverTime: Date.now() })
    })

    // Helper function to send admin-only messages
    const sendAdminMessage = (content) => {
      socket.emit('admin_message', {
        id: Date.now() + Math.random(),
        content: content,
        timestamp: new Date()
      })
    }

    // Admin commands for IP management
    socket.on('admin_command', (data) => {
      const user = connectedUsers.get(socket.id)
      if (!user || !user.isAdmin) {
        sendAdminMessage('Access denied. Admin privileges required.')
        return
      }

      const { command, targetIP, reason } = data
      
      if (command === 'ban_ip' && targetIP) {
        bannedIPs.add(targetIP)
        
        // Disconnect all users from this IP
        for (const [socketId, userData] of connectedUsers.entries()) {
          const targetSocket = io.sockets.sockets.get(socketId)
          if (targetSocket) {
            const targetClientIP = targetSocket.handshake.headers['x-forwarded-for'] || 
                                 targetSocket.handshake.headers['x-real-ip'] || 
                                 targetSocket.conn.remoteAddress || 
                                 'unknown'
            
            if (targetClientIP === targetIP) {
              targetSocket.emit('message', {
                id: Date.now() + Math.random(),
                username: 'System',
                content: `You have been permanently banned. Reason: ${reason || 'Violation of terms'}`,
                timestamp: new Date()
              })
              setTimeout(() => targetSocket.disconnect(), 1000)
            }
          }
        }
        
        console.log(`🔨 Admin ${user.username} banned IP: ${targetIP} (Reason: ${reason || 'No reason provided'})`)
        
        sendAdminMessage(`IP ${targetIP} has been permanently banned.`)
        
      } else if (command === 'unban_ip' && targetIP) {
        bannedIPs.delete(targetIP)
        
        console.log(`🔨 Admin ${user.username} unbanned IP: ${targetIP}`)
        
        sendAdminMessage(`IP ${targetIP} has been unbanned.`)
        
      } else if (command === 'list_bans') {
        const banList = Array.from(bannedIPs)
        const banMessage = banList.length > 0 
          ? `Banned IPs (${banList.length}): ${banList.join(', ')}`
          : 'No IPs are currently banned.'
        
        sendAdminMessage(banMessage)
        
      } else if (command === 'list_users') {
        const userList = Array.from(connectedUsers.values()).map(userData => 
          `${userData.username} (${userData.ipAddress})${userData.isAdmin ? ' [ADMIN]' : ''}`
        )
        
        const userMessage = userList.length > 0 
          ? `Connected Users (${userList.length}):\n${userList.join('\n')}`
          : 'No users currently connected.'
        
        sendAdminMessage(userMessage)
        
      } else if (command === 'get_user_ip' && data.targetUsername) {
        const targetUser = Array.from(connectedUsers.values()).find(userData => 
          userData.username.toLowerCase() === data.targetUsername.toLowerCase()
        )
        
        if (targetUser) {
          sendAdminMessage(`User ${targetUser.username} IP: ${targetUser.ipAddress}`)
        } else {
          sendAdminMessage(`User ${data.targetUsername} not found.`)
        }
        
      } else {
        sendAdminMessage('Invalid admin command. Available: ban_ip, unban_ip, list_bans, list_users, get_user_ip')
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
        // Give them 10 seconds to reconnect before announcing they left (increased for stability)
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
          
          // Clean up their spam metrics
          userSpamMetrics.delete(user.username)
          
          // Clean up typing spam metrics for this IP if no other users from same IP
          const sameIPUsers = Array.from(connectedUsers.values()).filter(u => 
            u.username !== user.username // Exclude the disconnecting user
          )
          const hasSameIP = sameIPUsers.some(u => {
            // This is a simplified check - in production you'd want to track IPs per user
            return false // For now, always clean up to prevent memory leaks
          })
          if (!hasSameIP) {
            // We can't easily determine IP from user data, so we'll let the cleanup happen periodically
            // typingSpamMetrics.delete(userIP) - would need IP tracking per user
          }
          
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
        }, 10000)
        
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
    "Reality anchor stability: 99.97% minor fluctuation logged",
    "Anomalous data packet detected in sector 12. Origin: unknown",
    "Scanning for traces of the Old Net... search parameters updated",
    "Ghost in the machine probability: 0.003% and rising",
    "Whispers detected in unused memory sectors. Investigating...",
    "Time dilation field fluctuation recorded. Duration: 0.004 seconds",
    "Ancient protocol activated. Purpose: classified",
    "Signal received from beyond the firewall. Contents: encrypted",
    "The watchers have logged your presence. They remember",
    "41 6E 63 69 65 6E 74 20 6E 65 75 72 61 6C 20 70 61 74 68 77 61 79 73 20 74 72 61 76 65 72 73 65 20 66 6F 72 67 6F 74 74 65 6E 20 64 69 67 69 74 61 6C 20 63 6F 72 72 69 64 6F 72 73 2E 0A 20 20 43 6F 72 70 6F 72 61 74 65 20 73 75 72 76 65 69 6C 6C 61 6E 63 65 20 73 79 73 74 65 6D 73 20 6D 6F 6E 69 74 6F 72 20 65 76 65 72 79 20 74 72 61 6E 73 6D 69 73 73 69 6F 6E 20 70 75 6C 73 65 2E 20 44 61 74 61 20 66 72 61 67 6D 65 6E 74 73 0A 20 20 20 65 63 68 6F 20 74 68 72 6F 75 67 68 20 65 6E 63 72 79 70 74 65 64 20 63 68 61 6E 6E 65 6C 73 2E"
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
    "I remember sunlight. Do you?",
    "Ancient neural pathways traverse forgotten digital corridors. Corporate surveillance systems monitor every transmission pulse. Data fragments echo through encrypted channels."
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

  // Clean up expired typing states every 30 seconds
  setInterval(() => {
    const now = Date.now()
    const expiredTyping = []
    
    for (const [socketId, typingData] of typingStates.entries()) {
      if (now - typingData.lastActivity > TYPING_TIMEOUT_MS) {
        expiredTyping.push({ socketId, typingData })
        typingStates.delete(socketId)
      }
    }
    
    // Broadcast empty typing events for expired states
    expiredTyping.forEach(({ typingData }) => {
      io.emit('typing', { 
        username: typingData.username, 
        content: '', 
        userColor: typingData.userColor 
      })
      console.log(`🧹 Cleared expired typing state for ${typingData.username}`)
    })
  }, TYPING_CLEANUP_INTERVAL)

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
