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
    lastUpdate: Date.now()
  }
  
  // Vote skip state
  const skipVotes = new Set() // Track usernames who voted to skip
  let currentVideoUrl = '' // Track current video for vote validation

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`)

    socket.on('join', (data) => {
      const { username } = data
      
      // Check if this user was recently disconnected (reconnection)
      const wasReconnecting = disconnectionTimeouts.has(username)
      if (wasReconnecting) {
        // Cancel the disconnection timeout - user reconnected
        clearTimeout(disconnectionTimeouts.get(username))
        disconnectionTimeouts.delete(username)
        console.log(`User reconnected: ${username}`)
      } else {
        // New user joining
        socket.broadcast.emit('user_joined', { username })
        console.log(`User joined: ${username}`)
      }
      
      connectedUsers.set(socket.id, { username, socketId: socket.id })
      
      // Emit updated user count to all clients
      io.emit('user_count', connectedUsers.size)
      console.log(`User count updated: ${connectedUsers.size}`)
      
      // Send current media player state to the newly joined user
      socket.emit('media_state_sync', mediaPlayerState)
      
      // Send current skip votes if there's a video playing
      if (mediaPlayerState.videoId) {
        socket.emit('skip_votes_update', { 
          votes: skipVotes.size, 
          required: Math.ceil(connectedUsers.size / 2),
          totalUsers: connectedUsers.size 
        })
      }
    })

    socket.on('message', (message) => {
      console.log('Message received:', message)
      // Broadcast the message to all connected clients
      io.emit('message', message)
    })

    socket.on('typing', (data) => {
      const { username, content } = data
      
      if (content) {
        typingStates.set(socket.id, { username, content })
      } else {
        typingStates.delete(socket.id)
      }
      
      // Broadcast typing state to other clients (not the sender)
      socket.broadcast.emit('typing', { username, content })
    })

    // Media player synchronization events
    socket.on('media_play', (data) => {
      const { videoId, url, timestamp, username } = data
      mediaPlayerState = {
        videoId,
        url,
        isPlaying: true,
        isMuted: mediaPlayerState.isMuted,
        timestamp: timestamp || 0,
        lastUpdate: Date.now()
      }
      
      // Reset skip votes for new video
      skipVotes.clear()
      currentVideoUrl = url
      
      // Broadcast to all clients including sender for consistency
      io.emit('media_play', mediaPlayerState)
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
      mediaPlayerState = {
        videoId: '',
        url: '',
        isPlaying: false,
        isMuted: false,
        timestamp: 0,
        lastUpdate: Date.now()
      }
      
      // Clear skip votes when video stops
      skipVotes.clear()
      currentVideoUrl = ''
      
      io.emit('media_stop')
      io.emit('skip_votes_update', { 
        votes: 0, 
        required: Math.ceil(connectedUsers.size / 2),
        totalUsers: connectedUsers.size 
      })
      console.log(`Media stopped by ${username || 'unknown user'}`)
      
      // Send system message about media stop
      const systemMessage = {
        id: Date.now() + Math.random(),
        username: 'System',
        content: `${username} has terminated media broadcast`,
        timestamp: new Date()
      }
      io.emit('message', systemMessage)
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
        // Execute skip
        mediaPlayerState = {
          videoId: '',
          url: '',
          isPlaying: false,
          isMuted: false,
          timestamp: 0,
          lastUpdate: Date.now()
        }
        
        skipVotes.clear()
        currentVideoUrl = ''
        
        io.emit('media_stop')
        io.emit('skip_votes_update', { 
          votes: 0, 
          required: Math.ceil(connectedUsers.size / 2),
          totalUsers: connectedUsers.size 
        })
        
        // Send skip success message
        const skipMessage = {
          id: Date.now() + Math.random(),
          username: 'System',
          content: `Media broadcast terminated by collective decision`,
          timestamp: new Date()
        }
        io.emit('message', skipMessage)
        
        console.log(`Video skipped by vote: ${currentVotes}/${requiredVotes}`)
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
          socket.broadcast.emit('user_left', { username: user.username })
          console.log(`User left: ${user.username}`)
          disconnectionTimeouts.delete(user.username)
          
          // Remove their skip vote if they had one
          skipVotes.delete(user.username)
          
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
