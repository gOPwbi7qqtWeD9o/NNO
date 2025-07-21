# Terminal Chat

A real-time terminal-style chat application with retro aesthetics inspired by post-apocalyptic and industrial themes.

## Features

- **Real-time messaging** with Socket.IO
- **Live typing indicators** - see what others are typing as they type
- **Terminal aesthetics** with authentic retro styling
- **Simple interface** - just enter a username and start chatting
- **System notifications** for user join/leave events
- **Responsive design** that works on all devices

## Tech Stack

- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Socket.IO** for real-time communication
- **Tailwind CSS** for styling
- **Custom Node.js server** for WebSocket support

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the development server:**
   ```bash
   npm run dev
   ```

3. **Open your browser and navigate to:**
   ```
   http://localhost:3000
   ```

4. **Enter a username and start chatting!**

## How It Works

1. Enter your username on the initial screen
2. Type your messages in the terminal-style input
3. See real-time typing indicators from other users
4. All messages appear with timestamps in terminal format
5. System messages notify when users join or leave

## Design Philosophy

This chat application embraces a retro terminal aesthetic without being tacky or overly "hacker-style". The design draws inspiration from:

- Classic terminal interfaces
- Post-apocalyptic and industrial aesthetics  
- Muted color palettes (greens, oranges, blues)
- Authentic monospace typography
- Minimal, functional interface design

## Project Structure

```
src/
├── app/
│   ├── globals.css          # Global styles with terminal theme
│   ├── layout.tsx           # Root layout component
│   ├── page.tsx             # Main chat interface
│   └── api/
│       └── socket/
│           └── route.ts     # Socket.IO API route
├── server.js                # Custom Socket.IO server
└── .github/
    └── copilot-instructions.md
```

## Real-time Features

- **Instant messaging** - Messages appear immediately for all users
- **Typing indicators** - See exactly what others are typing in real-time
- **Connection status** - System messages for user presence
- **Auto-scroll** - Chat automatically scrolls to show new messages

## Customization

The terminal theme can be customized in `tailwind.config.js`:

```javascript
colors: {
  terminal: {
    bg: '#0c0c0c',      // Background
    text: '#cccccc',    // Default text
    green: '#0dbc79',   // User prompts
    orange: '#e5c07b',  // Timestamps
    blue: '#61afef',    // Other users
    // ... more colors
  }
}
```

## Contributing

This project is designed to be simple and focused. If you'd like to contribute:

1. Keep the terminal aesthetic authentic
2. Maintain the minimal interface approach
3. Test real-time features with multiple browser tabs
4. Follow the existing TypeScript patterns

## License

MIT License - feel free to use this code for your own projects!
