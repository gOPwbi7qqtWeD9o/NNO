<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

# Terminal Chat Application

This is a real-time terminal-style chat application built with Next.js, TypeScript, and Socket.IO.

## Project Structure
- Uses Next.js with App Router and TypeScript
- Custom Socket.IO server for real-time communication
- Tailwind CSS with custom terminal color scheme
- Real-time typing indicators
- Retro terminal aesthetics with post-apocalyptic/industrial styling

## Design Guidelines
- Follow a retro terminal aesthetic with green text on dark background
- Use monospace fonts (Fira Code preferred)
- Colors should be muted and industrial: greens, oranges, blues, purples
- Avoid bright or flashy colors - keep it tasteful and authentic
- Terminal-style prompts with user@terminal:~$ format
- Timestamp format: [HH:MM:SS]

## Technical Guidelines
- Use Socket.IO for real-time features
- Implement typing indicators that show what users are typing
- Keep the interface minimal - just username entry and chat
- Use proper TypeScript types for all Socket.IO events
- Maintain terminal authenticity in all UI elements

## Key Features
- Real-time chat with typing indicators
- Terminal-style interface
- No user authentication - just username entry
- System messages for user join/leave events
- Smooth animations and transitions
