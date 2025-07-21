import { NextRequest } from 'next/server'
import { Server } from 'socket.io'

// Store for connected users and their typing states
const connectedUsers = new Map<string, { username: string, socketId: string }>()
const typingStates = new Map<string, { username: string, content: string }>()

export async function GET(request: NextRequest) {
  if (!(global as any).io) {
    console.log('Initializing Socket.io server...')
    
    const io = new Server({
      path: '/api/socket',
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    })

    io.on('connection', (socket) => {
      console.log(`Client connected: ${socket.id}`)

      socket.on('join', (data: { username: string }) => {
        const { username } = data
        connectedUsers.set(socket.id, { username, socketId: socket.id })
        
        // Notify others that a user joined
        socket.broadcast.emit('user_joined', { username })
        console.log(`User joined: ${username}`)
      })

      socket.on('message', (message: any) => {
        console.log('Message received:', message)
        // Broadcast the message to all connected clients
        io.emit('message', message)
      })

      socket.on('typing', (data: { username: string, content: string }) => {
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

    ;(global as any).io = io
  }

  return new Response('Socket.IO server initialized', { status: 200 })
}
