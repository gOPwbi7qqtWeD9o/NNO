import React, { useState, useRef, useEffect } from 'react'

interface MediaPlayerProps {
  onVolumeChange?: (volume: number) => void
}

const MediaPlayer: React.FC<MediaPlayerProps> = ({ onVolumeChange }) => {
  const [isClient, setIsClient] = useState(false)
  const [url, setUrl] = useState('')
  const [isMinimized, setIsMinimized] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [videoId, setVideoId] = useState('')
  const [hasError, setHasError] = useState(false)
  const windowRef = useRef<HTMLDivElement>(null)

  // Ensure this only runs on the client
  useEffect(() => {
    setIsClient(true)
    if (typeof window !== 'undefined') {
      // Position it more centered and lower on screen
      setPosition({ x: window.innerWidth - 450, y: 100 })
    }
  }, [])

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
    
    const extractedVideoId = extractYouTubeUrl(url)
    if (extractedVideoId) {
      setVideoId(extractedVideoId)
      setIsMinimized(false)
      setHasError(false) // Reset error state
    } else {
      alert('Please enter a valid YouTube URL')
    }
  }

  const handleClose = () => {
    setVideoId('')
    setUrl('')
    setIsMuted(false)
    setHasError(false)
  }

  const handleMinimize = () => {
    setIsMinimized(!isMinimized)
  }

  const handleMuteToggle = () => {
    setIsMuted(!isMuted)
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
              {isMinimized ? `Media Player ${isMuted ? '(Muted)' : ''}` : 'Media Player'}
            </div>
            <div className="flex gap-2">
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
                  className="bg-terminal-rust/80 hover:bg-terminal-rust text-terminal-bg px-3 py-1 rounded text-sm font-mono transition-colors"
                >
                  Play
                </button>
              </form>
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
