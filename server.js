const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  })

  // Store for connected users and their typing states
  const connectedUsers = new Map()
  const typingStates = new Map()

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`)

    socket.on('join', (data) => {
      const { username } = data
      connectedUsers.set(socket.id, { username, socketId: socket.id })
      
      // Notify others that a user joined
      socket.broadcast.emit('user_joined', { username })
      console.log(`User joined: ${username}`)
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
        // Notify others that user left
        socket.broadcast.emit('user_left', { username: user.username })
        connectedUsers.delete(socket.id)
        typingStates.delete(socket.id)
        console.log(`User left: ${user.username}`)
      }
      console.log(`Client disconnected: ${socket.id}`)
    })
  })

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
  })
})
