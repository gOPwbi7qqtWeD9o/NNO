import React, { useState, useRef, useEffect } from 'react'
import { Socket } from 'socket.io-client'

// YouTube Player API type declarations
declare global {
  interface Window {
    YT: {
      Player: any
      PlayerState: {
        ENDED: number
      }
    }
    onYouTubeIframeAPIReady: () => void
  }
}

interface MediaPlayerProps {
  socket: Socket | null
  username: string
  onVolumeChange?: (volume: number) => void
}

interface QueueItem {
  videoId: string
  queuedBy: string
  title: string
}

interface CurrentlyPlaying {
  videoId: string
  queuedBy: string
}

const MediaPlayer: React.FC<MediaPlayerProps> = ({ socket, username, onVolumeChange }) => {
  const [isClient, setIsClient] = useState(false)
  const [url, setUrl] = useState('')
  const [isMinimized, setIsMinimized] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [videoId, setVideoId] = useState('')
  const [hasError, setHasError] = useState(false)
  const [skipVotes, setSkipVotes] = useState({ votes: 0, required: 1, totalUsers: 1 })
  const [hasVoted, setHasVoted] = useState(false)
  const [videoOwner, setVideoOwner] = useState('')
  const [cooldownRemaining, setCooldownRemaining] = useState(0)
  const [queueList, setQueueList] = useState<QueueItem[]>([])
  const [currentlyPlaying, setCurrentlyPlaying] = useState<CurrentlyPlaying | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [syncInfo, setSyncInfo] = useState<{
    serverTime: number
    currentTime: number
    startTime: number | null
  } | null>(null)
  const [shouldSync, setShouldSync] = useState(false)
  const windowRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null) // YouTube Player API reference

  // Ensure this only runs on the client
  useEffect(() => {
    setIsClient(true)
    if (typeof window !== 'undefined') {
      // Check if mobile and set state
      const checkMobile = () => {
        setIsMobile(window.innerWidth < 768)
      }
      
      checkMobile()
      window.addEventListener('resize', checkMobile)
      
      // Mobile-friendly positioning
      if (window.innerWidth < 768) {
        // On mobile, position at bottom center
        setPosition({ x: 10, y: window.innerHeight - 180 })
      } else {
        // Desktop positioning
        setPosition({ x: window.innerWidth - 450, y: 100 })
      }
      
      return () => window.removeEventListener('resize', checkMobile)
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
        setVideoOwner(state.queuedBy || '')
        setHasError(false)
        
        // Store sync information for time synchronization
        if (state.currentTime !== undefined && state.serverTime && state.startTime) {
          setSyncInfo({
            serverTime: state.serverTime,
            currentTime: state.currentTime,
            startTime: state.startTime
          })
          setShouldSync(true)
        }
      }
    })

    // Listen for media play events from other users
    socket.on('media_play', (state) => {
      setVideoId(state.videoId)
      setUrl(state.url)
      setVideoOwner(state.queuedBy || '')
      setHasError(false)
      setHasVoted(false) // Reset vote status for new video
      
      // Store sync information for time synchronization
      if (state.currentTime !== undefined && state.serverTime && state.startTime) {
        setSyncInfo({
          serverTime: state.serverTime,
          currentTime: state.currentTime,
          startTime: state.startTime
        })
        setShouldSync(true)
      }
    })

    // Listen for media pause events
    socket.on('media_pause', (state) => {
      // Note: We can't actually control YouTube iframe playback state
      // But we can show visual indicators or sync state
    })

    // Listen for media stop events
    socket.on('media_stop', () => {
      setVideoId('')
      setUrl('')
      setHasError(false)
      setHasVoted(false) // Reset vote status when video stops
      setVideoOwner('') // Clear video owner
      setSyncInfo(null) // Clear sync info
      setShouldSync(false)
    })

    // Listen for skip vote updates
    socket.on('skip_votes_update', (voteData) => {
      setSkipVotes(voteData)
    })

    // Listen for queue updates
    socket.on('queue_update', (queueData) => {
      setQueueList(queueData.queue || [])
      setCurrentlyPlaying(queueData.currentlyPlaying)
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
      // Cleanup YouTube player
      if (playerRef.current) {
        try {
          playerRef.current.destroy()
          playerRef.current = null
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      
      socket.off('media_state_sync')
      socket.off('media_play')
      socket.off('media_pause')
      socket.off('media_stop')
      socket.off('skip_votes_update')
      socket.off('queue_update')
      socket.off('message')
    }
  }, [socket, username])

  // YouTube Player API setup
  useEffect(() => {
    if (!isClient || typeof window === 'undefined') return

    // Wait for YouTube API to load
    const initYouTubeAPI = () => {
      if (window.YT && window.YT.Player) {
        // API is ready
        return
      }
      
      // Set up the callback for when API loads
      window.onYouTubeIframeAPIReady = () => {
        console.log('YouTube API ready')
      }
    }

    // Check if API is already loaded or load it
    if (window.YT) {
      initYouTubeAPI()
    } else {
      // Wait for script to load
      const checkAPI = setInterval(() => {
        if (window.YT) {
          clearInterval(checkAPI)
          initYouTubeAPI()
        }
      }, 100)
      
      // Cleanup interval after 10 seconds
      setTimeout(() => clearInterval(checkAPI), 10000)
    }
  }, [isClient])

  // Initialize YouTube player when videoId changes
  useEffect(() => {
    if (!isClient || !videoId || typeof window === 'undefined') return

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) {
        // YouTube API not ready, try again in 100ms
        setTimeout(initPlayer, 100)
        return
      }

      // Wait a bit for the iframe to be in DOM
      setTimeout(() => {
        const iframeId = `youtube-player-${videoId}`
        const iframe = document.getElementById(iframeId)
        
        if (iframe) {
          try {
            // Destroy existing player
            if (playerRef.current) {
              try {
                playerRef.current.destroy()
              } catch (e) {
                console.log('Previous player cleanup:', e)
              }
            }

            // Create new player
            playerRef.current = new window.YT.Player(iframeId, {
              events: {
                onReady: (event: any) => {
                  console.log('🎵 YouTube player ready for', videoId)
                  
                  // Sync to server time if we have sync info
                  if (shouldSync && syncInfo) {
                    const now = Date.now()
                    const timeSinceServerSync = now - syncInfo.serverTime
                    const targetTime = syncInfo.currentTime + Math.floor(timeSinceServerSync / 1000)
                    
                    console.log('🔄 Syncing to server time:', targetTime, 'seconds')
                    
                    try {
                      event.target.seekTo(targetTime, true)
                      setShouldSync(false) // Only sync once per video
                    } catch (error) {
                      console.warn('Failed to sync video time:', error)
                    }
                  }
                },
                onStateChange: (event: any) => {
                  console.log('🎵 YouTube player state changed:', event.data)
                  // YT.PlayerState.ENDED = 0
                  if (event.data === 0) {
                    console.log('🎵 YouTube video ended, advancing queue')
                    if (socket) {
                      socket.emit('media_ended', { username })
                    }
                  }
                },
                onError: (event: any) => {
                  console.error('🎵 YouTube player error:', event.data)
                }
              }
            })
            
            console.log('YouTube player initialized for', videoId)
          } catch (error) {
            console.error('Failed to initialize YouTube player:', error)
          }
        } else {
          console.warn('Could not find YouTube iframe element')
        }
      }, 500) // Increased delay to ensure iframe is ready
    }

    initPlayer()

    return () => {
      if (playerRef.current) {
        try {
          playerRef.current.destroy()
          playerRef.current = null
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
  }, [videoId, socket, username, isClient])

  // Handle synchronization when sync info becomes available
  useEffect(() => {
    if (!shouldSync || !syncInfo || !playerRef.current) return

    const syncPlayer = () => {
      try {
        const now = Date.now()
        const timeSinceServerSync = now - syncInfo.serverTime
        const targetTime = syncInfo.currentTime + Math.floor(timeSinceServerSync / 1000)
        
        console.log('🔄 Late sync to server time:', targetTime, 'seconds')
        playerRef.current.seekTo(targetTime, true)
        setShouldSync(false)
      } catch (error) {
        console.warn('Failed to sync video time:', error)
      }
    }

    // Small delay to ensure player is fully ready
    const syncTimeout = setTimeout(syncPlayer, 500)
    return () => clearTimeout(syncTimeout)
  }, [shouldSync, syncInfo])

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

  // Generate embed URL with API enablement (no mute param to prevent restart)
  const generateEmbedUrl = (videoId: string): string => {
    if (!videoId) return ''
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1&playsinline=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}`
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
      // Start a 10-second cooldown
      setCooldownRemaining(10)
      
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

  const handleVoteSkip = () => {
    if (!hasVoted && videoId && socket) {
      socket.emit('vote_skip', { username })
      setHasVoted(true)
    }
  }

  // Dragging functionality - supports both mouse and touch
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isClient || !windowRef.current) return
    
    e.preventDefault()
    e.stopPropagation()
    
    const rect = windowRef.current.getBoundingClientRect()
    const clientX = e.clientX
    const clientY = e.clientY
    const offsetX = clientX - rect.left
    const offsetY = clientY - rect.top
    
    setDragOffset({ x: offsetX, y: offsetY })
    setIsDragging(true)
    
    const handleMouseMove = (e: MouseEvent) => {
      if (typeof window === 'undefined') return
      
      const isMobile = window.innerWidth < 768
      const maxWidth = isMobile ? window.innerWidth - 20 : window.innerWidth - 400
      const maxHeight = window.innerHeight - (isMobile ? 100 : 300)
      
      const newX = Math.max(10, Math.min(maxWidth, e.clientX - offsetX))
      const newY = Math.max(10, Math.min(maxHeight, e.clientY - offsetY))
      
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

  // Touch support for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isClient || !windowRef.current) return
    
    e.preventDefault()
    e.stopPropagation()
    
    const rect = windowRef.current.getBoundingClientRect()
    const touch = e.touches[0]
    const offsetX = touch.clientX - rect.left
    const offsetY = touch.clientY - rect.top
    
    setDragOffset({ x: offsetX, y: offsetY })
    setIsDragging(true)
    
    const handleTouchMove = (e: TouchEvent) => {
      if (typeof window === 'undefined' || e.touches.length === 0) return
      
      const touch = e.touches[0]
      const isMobile = window.innerWidth < 768
      const maxWidth = isMobile ? window.innerWidth - 20 : window.innerWidth - 400
      const maxHeight = window.innerHeight - (isMobile ? 100 : 300)
      
      const newX = Math.max(10, Math.min(maxWidth, touch.clientX - offsetX))
      const newY = Math.max(10, Math.min(maxHeight, touch.clientY - offsetY))
      
      setPosition({ x: newX, y: newY })
    }

    const handleTouchEnd = () => {
      setIsDragging(false)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }

    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd)
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
          width: isMobile ? `${typeof window !== 'undefined' ? window.innerWidth - 20 : 350}px` : '400px',
          maxWidth: isMobile ? `${typeof window !== 'undefined' ? window.innerWidth - 20 : 350}px` : '400px',
          height: isMinimized ? '40px' : (videoId ? (isMobile ? '250px' : '320px') : '120px'),
          userSelect: 'none',
        }}
      >
          {/* Window Controls */}
          <div
            className="flex items-center justify-between p-2 bg-terminal-rust/20 border-b border-terminal-rust/30 cursor-move select-none touch-none"
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            style={{ 
              userSelect: 'none',
              pointerEvents: 'auto',
              touchAction: 'none'
            }}
          >
            <div className="text-terminal-text text-sm font-mono flex-1 min-w-0">
              <div className="truncate">
                {isMinimized ? 'Shared Media Player' : 'Shared Media Player'}
                {videoId && <span className="text-terminal-amber ml-1">● LIVE</span>}
                {videoId && videoOwner && <span className="text-terminal-dim ml-1 hidden sm:inline">by {videoOwner}</span>}
              </div>
            </div>
            <div className="flex gap-1 sm:gap-2 flex-shrink-0">
              {/* Vote Skip Button - Only show when video is playing */}
              {videoId && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleVoteSkip()
                  }}
                  disabled={hasVoted}
                  className={`px-2 h-6 sm:h-4 rounded-sm text-xs flex items-center justify-center transition-colors ${
                    hasVoted 
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                      : 'bg-orange-700 hover:bg-orange-600 text-white'
                  }`}
                  title={hasVoted ? 'Already voted' : `Vote to skip (${skipVotes.votes}/${skipVotes.required})`}
                >
                  {hasVoted ? '✓' : 'SKIP'}
                </button>
              )}
              
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  handleMinimize()
                }}
                className="w-6 h-6 sm:w-4 sm:h-4 bg-terminal-dim hover:bg-terminal-rust rounded-sm text-xs text-terminal-bg flex items-center justify-center"
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
                  className="w-6 h-6 sm:w-4 sm:h-4 bg-red-700 hover:bg-red-600 rounded-sm text-xs text-white flex items-center justify-center"
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
              
              {/* Queue Display - Show when there are queued songs */}
              {queueList.length > 0 && (
                <div className="mt-2 text-xs text-terminal-dim">
                  <div className="text-terminal-text font-mono">Queue ({queueList.length}):</div>
                  <div className="mt-1 space-y-1 max-h-16 sm:max-h-20 overflow-y-auto">
                    {queueList.slice(0, isMobile ? 2 : 3).map((item, index) => (
                      <div key={index} className="flex justify-between items-center">
                        <span className="flex-shrink-0">{index + 1}. {item.queuedBy}</span>
                        <span className="text-terminal-rust text-xs truncate ml-2 flex-1 text-right sm:max-w-32">
                          {item.title.length > (isMobile ? 20 : 30) 
                            ? item.title.substring(0, isMobile ? 20 : 30) + '...' 
                            : item.title}
                        </span>
                      </div>
                    ))}
                    {queueList.length > (isMobile ? 2 : 3) && (
                      <div className="text-terminal-amber text-xs">
                        +{queueList.length - (isMobile ? 2 : 3)} more...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Video Content - Always render when videoId exists, but hide when minimized */}
          {videoId && (
            <div 
              className="flex-1 relative"
              style={{ 
                display: isMinimized ? 'none' : 'block' 
              }}
            >
              <iframe
                id={`youtube-player-${videoId}`}
                key={videoId} // Remove mute from key to prevent restart
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
