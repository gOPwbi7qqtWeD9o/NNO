import React, { useState, useRef, useEffect } from 'react'

interface MediaPlayerProps {
  onVolumeChange?: (volume: number) => void
}

const MediaPlayer: React.FC<MediaPlayerProps> = ({ onVolumeChange }) => {
  const [isClient, setIsClient] = useState(false)
  const [url, setUrl] = useState('')
  const [isVisible, setIsVisible] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const [embedUrl, setEmbedUrl] = useState('')
  const windowRef = useRef<HTMLDivElement>(null)

  // Ensure this only runs on the client
  useEffect(() => {
    setIsClient(true)
    if (typeof window !== 'undefined') {
      setPosition({ x: window.innerWidth - 400, y: 20 })
    }
  }, [])

  // Extract YouTube video ID and create embed URL
  const extractYouTubeUrl = (inputUrl: string): string => {
    const cleanUrl = inputUrl.trim()
    
    // YouTube URL patterns
    const youtubeRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    const match = cleanUrl.match(youtubeRegex)
    
    if (match && match[1]) {
      const videoId = match[1]
      return `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0&modestbranding=1`
    }
    
    return ''
  }

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    
    const youtubeUrl = extractYouTubeUrl(url)
    if (youtubeUrl) {
      setEmbedUrl(youtubeUrl)
      setIsVisible(true)
      setIsMinimized(false)
    } else {
      alert('Please enter a valid YouTube URL')
    }
  }

  const handleClose = () => {
    setIsVisible(false)
    setEmbedUrl('')
    setUrl('')
  }

  const handleMinimize = () => {
    setIsMinimized(!isMinimized)
  }

  // Dragging functionality - only works on client
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isClient || !windowRef.current) return
    
    setIsDragging(true)
    const rect = windowRef.current.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    })
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !isClient || typeof window === 'undefined') return
    
    setPosition({
      x: Math.max(0, Math.min(window.innerWidth - 400, e.clientX - dragOffset.x)),
      y: Math.max(0, Math.min(window.innerHeight - 300, e.clientY - dragOffset.y))
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (!isClient) return
    
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset, isClient])

  // Don't render anything until we're on the client
  if (!isClient) {
    return null
  }

  return (
    <>
      {/* URL Input Form - Always visible */}
      <div className="fixed top-4 left-4 z-40 bg-black/80 backdrop-blur-sm rounded-lg border border-terminal-rust/50 p-3">
        <form onSubmit={handleUrlSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste YouTube URL..."
            className="bg-terminal-bg border border-terminal-rust/30 rounded px-3 py-1 text-terminal-text text-sm focus:border-terminal-rust focus:outline-none font-mono"
          />
          <button
            type="submit"
            className="bg-terminal-rust/80 hover:bg-terminal-rust text-terminal-bg px-3 py-1 rounded text-sm font-mono transition-colors"
          >
            Play
          </button>
        </form>
      </div>

      {/* Floating Media Player Window */}
      {isVisible && (
        <div
          ref={windowRef}
          className="fixed z-50 bg-terminal-bg/95 border border-terminal-rust/50 rounded-lg shadow-2xl backdrop-blur-sm"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
            width: '400px',
            height: isMinimized ? '40px' : '300px',
          }}
        >
          {/* Window Controls */}
          <div
            className="flex items-center justify-between p-2 bg-terminal-rust/20 border-b border-terminal-rust/30 cursor-move"
            onMouseDown={handleMouseDown}
          >
            <div className="text-terminal-text text-sm font-mono">Media Player</div>
            <div className="flex gap-2">
              <button
                onClick={handleMinimize}
                className="w-4 h-4 bg-terminal-dim hover:bg-terminal-rust rounded-sm text-xs text-terminal-bg flex items-center justify-center"
              >
                {isMinimized ? '□' : '_'}
              </button>
              <button
                onClick={handleClose}
                className="w-4 h-4 bg-red-700 hover:bg-red-600 rounded-sm text-xs text-white flex items-center justify-center"
              >
                ×
              </button>
            </div>
          </div>

          {/* Video Content */}
          {!isMinimized && embedUrl && (
            <div className="p-0 h-full">
              <iframe
                src={embedUrl}
                className="w-full h-full rounded-b-lg"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </div>
      )}
    </>
  )
}

export default MediaPlayer
