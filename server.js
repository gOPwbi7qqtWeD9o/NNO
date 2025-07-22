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
          
          // Emit updated user count to all clients
          io.emit('user_count', connectedUsers.size)
          console.log(`User count updated: ${connectedUsers.size}`)
        }, 5000)
        
        disconnectionTimeouts.set(user.username, timeout)
        console.log(`Client disconnected: ${socket.id}, grace period started for: ${user.username}`)
      } else {
        console.log(`Client disconnected: ${socket.id}`)
      }
    })
  })

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
    
    if (process.env.RAILWAY_ENVIRONMENT) {
      console.log('🚂 Railway deployment detected')
      console.log('🔒 SSL automatically handled by Railway')
    } else {
      console.log('� Local development mode')
    }
  })
})
