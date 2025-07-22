import React, { useState, useRef, useEffect } from 'react'
import { Socket } from 'socket.io-client'

interface MediaPlayerProps {
  socket: Socket | null
  username: string
  onVolumeChange?: (volume: number) => void
}

const MediaPlayer: React.FC<MediaPlayerProps> = ({ socket, username, onVolumeChange }) => {
  const [isClient, setIsClient] = useState(false)
  const [url, setUrl] = useState('')
  const [isMinimized, setIsMinimized] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [videoId, setVideoId] = useState('')
  const [hasError, setHasError] = useState(false)
  const [skipVotes, setSkipVotes] = useState({ votes: 0, required: 1, totalUsers: 1 })
  const [hasVoted, setHasVoted] = useState(false)
  const [videoOwner, setVideoOwner] = useState('')
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const windowRef = useRef<HTMLDivElement>(null)

  // Ensure this only runs on the client
  useEffect(() => {
    setIsClient(true)
    if (typeof window !== 'undefined') {
      // Position it more centered and lower on screen
      setPosition({ x: window.innerWidth - 450, y: 100 })
    }
  }, [])

  // Socket event handlers for media synchronization
  useEffect(() => {
    if (!socket) return

    // Listen for media state sync when joining
    socket.on('media_state_sync', (state) => {
      if (state.videoId) {
        setVideoId(state.videoId)
        setUrl(state.url)
        setIsMuted(state.isMuted)
        setVideoOwner(state.queuedBy || '')
        setIsMinimized(false)
        setHasError(false)
      }
    })

    // Listen for media play events from other users
    socket.on('media_play', (state) => {
      setVideoId(state.videoId)
      setUrl(state.url)
      setIsMuted(state.isMuted)
      setVideoOwner(state.queuedBy || '')
      setIsMinimized(false)
      setHasError(false)
      setHasVoted(false) // Reset vote status for new video
    })

    // Listen for media pause events
    socket.on('media_pause', (state) => {
      // Note: We can't actually control YouTube iframe playback state
      // But we can show visual indicators or sync state
    })

    // Listen for media mute events
    socket.on('media_mute', ({ isMuted: newMutedState }) => {
      setIsMuted(newMutedState)
    })

    // Listen for media stop events
    socket.on('media_stop', () => {
      setVideoId('')
      setUrl('')
      setIsMuted(false)
      setHasError(false)
      setHasVoted(false) // Reset vote status when video stops
      setVideoOwner('') // Clear video owner
    })

    // Listen for skip vote updates
    socket.on('skip_votes_update', (voteData) => {
      setSkipVotes(voteData)
    })

    // Listen for system messages to detect cooldown errors
    socket.on('message', (message) => {
      if (message.username === 'System' && message.content.includes('Queue cooldown active')) {
        // Extract remaining time from message and update local cooldown
        const timeMatch = message.content.match(/Wait (\d+) more seconds/)
        if (timeMatch) {
          setCooldownRemaining(parseInt(timeMatch[1]))
        }
      }
    })

    // Cleanup listeners
    return () => {
      socket.off('media_state_sync')
      socket.off('media_play')
      socket.off('media_pause')
      socket.off('media_mute')
      socket.off('media_stop')
      socket.off('skip_votes_update')
      socket.off('message')
    }
  }, [socket])

  // Cooldown timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (cooldownRemaining > 0) {
      interval = setInterval(() => {
        setCooldownRemaining(prev => {
          const newValue = prev - 1
          return newValue <= 0 ? 0 : newValue
        })
      }, 1000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [cooldownRemaining])

  // Extract YouTube video ID and create embed URL
  const extractYouTubeUrl = (inputUrl: string): string => {
    const cleanUrl = inputUrl.trim()
    
    // Enhanced YouTube URL patterns to handle more formats
    const patterns = [
      // Standard youtube.com URLs
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
      // youtu.be URLs
      /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
      // youtube.com embed URLs
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
      // Mobile youtube URLs
      /(?:https?:\/\/)?m\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
      // YouTube URLs with additional parameters
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/
    ]
    
    for (const pattern of patterns) {
      const match = cleanUrl.match(pattern)
      if (match && match[1]) {
        return match[1]
      }
    }
    
    return ''
  }

  // Generate embed URL with current mute state
  const generateEmbedUrl = (videoId: string): string => {
    if (!videoId) return ''
    const muteParam = isMuted ? '&mute=1' : '&mute=0'
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1${muteParam}&enablejsapi=1&playsinline=1`
  }

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    
    // Check for client-side cooldown
    if (cooldownRemaining > 0) {
      alert(`Please wait ${cooldownRemaining} more seconds before queuing another video.`)
      return
    }
    
    const extractedVideoId = extractYouTubeUrl(url)
    if (extractedVideoId) {
      // Start a 30-second cooldown
      setCooldownRemaining(30)
      
      // Emit to server for synchronization across all users
      if (socket) {
        socket.emit('media_play', {
          videoId: extractedVideoId,
          url: url,
          timestamp: 0,
          username: username
        })
      }
      // Local state will be updated via socket event
    } else {
      alert('Please enter a valid YouTube URL')
    }
  }

  const handleClose = () => {
    // Emit stop event to all users
    if (socket) {
      socket.emit('media_stop', { username: username })
    }
    // Local state will be updated via socket event
  }

  const handleMinimize = () => {
    setIsMinimized(!isMinimized)
  }

  const handleMuteToggle = () => {
    const newMutedState = !isMuted
    // Emit mute state to all users
    if (socket) {
      socket.emit('media_mute', { 
        isMuted: newMutedState,
        username: username 
      })
    }
    // Local state will be updated via socket event
  }

  const handleVoteSkip = () => {
    if (!hasVoted && videoId && socket) {
      socket.emit('vote_skip', { username })
      setHasVoted(true)
    }
  }

  // Dragging functionality - only works on client
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isClient || !windowRef.current) return
    
    e.preventDefault()
    e.stopPropagation()
    
    const rect = windowRef.current.getBoundingClientRect()
    const offsetX = e.clientX - rect.left
    const offsetY = e.clientY - rect.top
    
    setDragOffset({ x: offsetX, y: offsetY })
    setIsDragging(true)
    
    const handleMouseMove = (e: MouseEvent) => {
      if (typeof window === 'undefined') return
      
      const newX = Math.max(0, Math.min(window.innerWidth - 400, e.clientX - offsetX))
      const newY = Math.max(0, Math.min(window.innerHeight - 300, e.clientY - offsetY))
      
      setPosition({ x: newX, y: newY })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Don't render anything until we're on the client
  if (!isClient) {
    return null
  }

  return (
    <>
      {/* Unified Media Player Window */}
      <div
        ref={windowRef}
        className="fixed z-[9999] bg-terminal-bg/95 border border-terminal-rust/50 rounded-lg shadow-2xl backdrop-blur-sm select-none"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: '400px',
          height: isMinimized ? '40px' : (videoId ? '320px' : '120px'),
          userSelect: 'none',
        }}
      >
          {/* Window Controls */}
          <div
            className="flex items-center justify-between p-2 bg-terminal-rust/20 border-b border-terminal-rust/30 cursor-move select-none"
            onMouseDown={handleMouseDown}
            style={{ 
              userSelect: 'none',
              pointerEvents: 'auto',
              touchAction: 'none'
            }}
          >
            <div className="text-terminal-text text-sm font-mono">
              {isMinimized ? `Shared Media Player ${isMuted ? '(Muted)' : ''}` : 'Shared Media Player'}
              {videoId && <span className="text-terminal-amber ml-1">● LIVE</span>}
              {videoId && videoOwner && <span className="text-terminal-dim ml-1">by {videoOwner}</span>}
            </div>
            <div className="flex gap-2">
              {/* Vote Skip Button - Only show when video is playing */}
              {videoId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleVoteSkip()
                  }}
                  disabled={hasVoted}
                  className={`px-2 h-4 rounded-sm text-xs flex items-center justify-center transition-colors ${
                    hasVoted 
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                      : 'bg-orange-700 hover:bg-orange-600 text-white'
                  }`}
                  title={hasVoted ? 'Already voted' : `Vote to skip (${skipVotes.votes}/${skipVotes.required})`}
                >
                  {hasVoted ? '✓' : 'SKIP'}
                </button>
              )}
              
              {/* Mute Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleMuteToggle()
                }}
                className={`w-4 h-4 rounded-sm text-xs flex items-center justify-center ${
                  isMuted 
                    ? 'bg-red-600 hover:bg-red-500 text-white' 
                    : 'bg-terminal-dim hover:bg-terminal-rust text-terminal-bg'
                }`}
                title={isMuted ? 'Unmute' : 'Mute'}
              >
                {isMuted ? 'M' : 'S'}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  handleMinimize()
                }}
                className="w-4 h-4 bg-terminal-dim hover:bg-terminal-rust rounded-sm text-xs text-terminal-bg flex items-center justify-center"
                title={isMinimized ? 'Maximize' : 'Minimize'}
              >
                {isMinimized ? '□' : '-'}
              </button>
              
              {/* Close Button - Only show to video owner */}
              {(!videoId || videoOwner === username) && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    e.preventDefault()
                    handleClose()
                  }}
                  className="w-4 h-4 bg-red-700 hover:bg-red-600 rounded-sm text-xs text-white flex items-center justify-center"
                  title="Close"
                >
                  &times;
                </button>
              )}
            </div>
          </div>

          {/* URL Input Section - always visible when not minimized */}
          {!isMinimized && (
            <div className="p-3 border-b border-terminal-rust/30">
              <form onSubmit={handleUrlSubmit} className="flex items-center gap-2">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste YouTube URL..."
                  className="flex-1 bg-terminal-bg border border-terminal-rust/30 rounded px-3 py-1 text-terminal-text text-sm focus:border-terminal-rust focus:outline-none font-mono"
                />
                <button
                  type="submit"
                  disabled={cooldownRemaining > 0}
                  className={`px-3 py-1 rounded text-sm font-mono transition-colors ${
                    cooldownRemaining > 0 
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-terminal-rust/80 hover:bg-terminal-rust text-terminal-bg'
                  }`}
                >
                  {cooldownRemaining > 0 ? `Wait ${cooldownRemaining}s` : 'Play'}
                </button>
              </form>
              
              {/* Skip Votes Indicator - Show when video is playing */}
              {videoId && (
                <div className="mt-2 text-xs text-terminal-dim space-y-1">
                  <div className="flex items-center justify-between">
                    <span>Skip votes: {skipVotes.votes}/{skipVotes.required}</span>
                    <span className="text-terminal-amber">
                      {skipVotes.votes >= skipVotes.required ? 'TERMINATING...' : 
                       hasVoted ? 'REQUEST FILED' : 'Click SKIP to file request'}
                    </span>
                  </div>
                  {videoOwner && (
                    <div className="text-terminal-rust text-xs">
                      Queued by: {videoOwner} {videoOwner === username && '(You can close manually)'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Video Content */}
          {!isMinimized && videoId && (
            <div className="flex-1 relative">
              <iframe
                key={`${videoId}-${isMuted}`}
                src={generateEmbedUrl(videoId)}
                className="w-full h-full rounded-b-lg"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                onError={() => setHasError(true)}
              />
              {/* Error fallback overlay */}
              {hasError && (
                <div className="absolute inset-0 bg-terminal-bg/90 flex flex-col items-center justify-center rounded-b-lg">
                  <div className="text-terminal-text text-sm font-mono mb-2">Video cannot be embedded</div>
                  <button
                    onClick={() => window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank')}
                    className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded font-mono text-sm transition-colors"
                  >
                    Open in YouTube
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
    </>
  )
}

export default MediaPlayer
