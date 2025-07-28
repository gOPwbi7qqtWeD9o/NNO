'use client'

import { useEffect, useRef, useState } from 'react'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'

interface TerminalComponentProps {
  socket: any
  isVisible: boolean
  onClose: () => void
  username?: string
}

export default function TerminalComponent({ socket, isVisible, onClose, username }: TerminalComponentProps) {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const [currentLine, setCurrentLine] = useState('')

  useEffect(() => {
    if (!terminalRef.current || !isVisible) return

    // Initialize xterm.js
    const term = new Terminal({
      cursorBlink: true,
      theme: {
        background: '#000000',
        foreground: '#00ff41',
        cursor: '#00ff41',
      },
      fontSize: 16,
      fontFamily: '"Courier New", Courier, monospace',
      rows: 30,
      cols: 120,
    })

    xtermRef.current = term
    term.open(terminalRef.current)

    // Welcome message
    term.writeln('NeuralNode Shared Terminal v1.0')
    term.writeln('Connecting to shared terminal session...')
    term.writeln('')

    // Request terminal connection
    if (socket && socket.connected) {
      socket.emit('terminal_connect')
    }

    let currentInput = ''
    let cursorPos = 0
    let isConnected = false

    const showPrompt = () => {
      const prompt = `[${username || 'user'}] $ `
      term.write(prompt)
      return prompt.length
    }

    // Handle keyboard input
    term.onKey(({ key, domEvent }) => {
      const printable = !domEvent.altKey && !domEvent.ctrlKey && !domEvent.metaKey

      if (!isConnected) {
        term.write('\x07') // Bell sound for not connected
        return
      }

      if (domEvent.keyCode === 13) { // Enter
        term.writeln('')
        if (currentInput.trim()) {
          console.log('Sending terminal command:', currentInput.trim())
          console.log('Socket connected:', socket?.connected)
          // Send command to server
          if (socket && socket.connected) {
            socket.emit('terminal_command', { command: currentInput.trim(), username: username || 'user' })
          } else {
            term.writeln('Error: Not connected to server')
            showPrompt()
            return
          }
        } else {
          // Empty command, just show new prompt
          showPrompt()
        }
        currentInput = ''
        cursorPos = 0
      } else if (domEvent.keyCode === 8) { // Backspace
        if (cursorPos > 0) {
          currentInput = currentInput.slice(0, cursorPos - 1) + currentInput.slice(cursorPos)
          cursorPos--
          term.write('\b \b')
        }
      } else if (domEvent.keyCode === 37) { // Left arrow
        if (cursorPos > 0) {
          cursorPos--
          term.write('\x1b[D')
        }
      } else if (domEvent.keyCode === 39) { // Right arrow
        if (cursorPos < currentInput.length) {
          cursorPos++
          term.write('\x1b[C')
        }
      } else if (printable) {
        currentInput = currentInput.slice(0, cursorPos) + key + currentInput.slice(cursorPos)
        cursorPos++
        term.write(key)
      }
    })

    // Listen for terminal ready event
    const handleTerminalReady = (data: { message: string, shell: string }) => {
      console.log('Terminal ready:', data)
      isConnected = true
      term.writeln(`✓ ${data.message}`)
      term.writeln(`Shell: ${data.shell}`)
      term.writeln('')
      showPrompt() // Show proper prompt with username
    }

    // Listen for terminal output from server
    const handleTerminalOutput = (data: { output: string, fromUser?: string, showPrompt?: boolean }) => {
      console.log('Received terminal output:', data)
      
      if (data.fromUser) {
        // This is a command echo from another user
        term.writeln(data.output)
      } else {
        // This is actual terminal output - write it directly
        term.write(data.output)
        // Show prompt after command output if requested
        if (data.showPrompt && isConnected) {
          showPrompt()
        }
      }
    }

    socket?.on('terminal_ready', handleTerminalReady)
    socket?.on('terminal_output', handleTerminalOutput)

    return () => {
      socket?.off('terminal_ready', handleTerminalReady)
      socket?.off('terminal_output', handleTerminalOutput)
      term.dispose()
    }
  }, [socket, isVisible])

  if (!isVisible) return null

  return (
    <div className="bg-black border-2 border-terminal-amber rounded-lg overflow-hidden">
      <div className="bg-terminal-amber text-black px-3 py-1 text-sm font-mono flex items-center justify-between">
        <span>NeuralNode Shared Terminal</span>
        <button
          onClick={onClose}
          className="w-5 h-5 bg-red-600 hover:bg-red-700 rounded-sm text-xs text-white flex items-center justify-center transition-colors"
          title="Close Terminal"
        >
          ×
        </button>
      </div>
      <div 
        ref={terminalRef} 
        className="p-4"
        style={{ height: '100%', width: '100%' }}
      />
    </div>
  )
}