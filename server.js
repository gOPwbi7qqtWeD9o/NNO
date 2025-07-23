const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

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
      
      // Validate username exists and is a string
      if (!username || typeof username !== 'string' || !username.trim()) {
        socket.emit('message', {
          id: Date.now() + Math.random(),
          username: 'System',
          content: 'Invalid username. Connection rejected.',
          timestamp: new Date()
        })
        socket.disconnect()
        return
      }
      
      const cleanUsername = username.trim()
      
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
      
      // Check if this user was recently disconnected (reconnection)
      const wasReconnecting = disconnectionTimeouts.has(cleanUsername)
      if (wasReconnecting) {
        // Cancel the disconnection timeout - user reconnected
        clearTimeout(disconnectionTimeouts.get(cleanUsername))
        disconnectionTimeouts.delete(cleanUsername)
        console.log(`User reconnected: ${cleanUsername}`)
      } else {
        // New user joining
        socket.broadcast.emit('user_joined', { username: cleanUsername, userColor })
        console.log(`User joined: ${cleanUsername} (${userColor || 'no color'})`)
      }
      
      connectedUsers.set(socket.id, { username: cleanUsername, socketId: socket.id, userColor })
      
      // Emit updated user count to all clients
      io.emit('user_count', connectedUsers.size)
      console.log(`User count updated: ${connectedUsers.size}`)
      
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
      const currentTime = Date.now()
      
      // Validate message structure and content - detect script behavior
      if (!message || 
          !message.content || 
          typeof message.content !== 'string' || 
          !message.content.trim() ||
          !message.id ||
          !message.username ||
          !message.timestamp) {
        console.log(`❌ Invalid/incomplete message structure from ${username}:`, message)
        // This looks like a script that doesn't send proper message format
        socket.emit('message', {
          id: Date.now() + Math.random(),
          username: 'System',
          content: 'Message format error. Please use a proper client.',
          timestamp: new Date()
        })
        return
      }
      
      // Detect rapid-fire scripted behavior (very short messages sent rapidly)
      const messageLength = message.content.trim().length
      if (messageLength < 3) {
        // Short messages are more likely to be script spam
        if (!messageCooldowns.has(username)) {
          messageCooldowns.set(username, [])
        }
        
        const userMessages = messageCooldowns.get(username)
        const windowStart = currentTime - 5000 // 5 second window for short messages
        const recentShortMessages = userMessages.filter(msg => 
          msg.timestamp > windowStart && msg.length < 3
        )
        
        if (recentShortMessages.length >= 3) {
          console.log(`❌ Detected scripted spam pattern from ${username}: ${recentShortMessages.length} short messages in 5s`)
          socket.emit('message', {
            id: Date.now() + Math.random(),
            username: 'System',
            content: 'Automated behavior detected. Connection terminated.',
            timestamp: new Date()
          })
          socket.disconnect()
          return
        }
        
        // Track this short message
        userMessages.push({ timestamp: currentTime, length: messageLength })
        messageCooldowns.set(username, userMessages)
      }
      
      // Standard rate limiting for all messages
      if (!messageCooldowns.has(username)) {
        messageCooldowns.set(username, [])
      }
      
      const userMessages = messageCooldowns.get(username)
      // Remove messages older than the rate limit window
      const windowStart = currentTime - (RATE_LIMIT_WINDOW_SECONDS * 1000)
      const recentMessages = userMessages.filter(msg => 
        typeof msg === 'number' ? msg > windowStart : msg.timestamp > windowStart
      )
      
      if (recentMessages.length >= MESSAGE_RATE_LIMIT) {
        // User is rate limited
        console.log(`❌ Rate limit exceeded by ${username}: ${recentMessages.length}/${MESSAGE_RATE_LIMIT}`)
        socket.emit('message', {
          id: Date.now() + Math.random(),
          username: 'System',
          content: `Rate limit exceeded. Maximum ${MESSAGE_RATE_LIMIT} messages per ${RATE_LIMIT_WINDOW_SECONDS} seconds.`,
          timestamp: new Date()
        })
        return
      }
      
      // Add current message timestamp to rate limiting
      recentMessages.push(currentTime)
      messageCooldowns.set(username, recentMessages)
      
      console.log('Message received:', message)
      // Broadcast the message to all connected clients EXCEPT the sender
      socket.broadcast.emit('message', message)
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
