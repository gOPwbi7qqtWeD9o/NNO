import React, { useState, useRef, useEffect } from 'react'

interface MediaPlayerProps {
  onVolumeChange?: (volume: number) => void
}

const MediaPlayer: React.FC<MediaPlayerProps> = ({ onVolumeChange }) => {
  const [url, setUrl] = useState('')
  const [isPlaying, setIsPlaying] = useState(false)
  const [volume, setVolume] = useState(0.5)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTrack, setCurrentTrack] = useState('')
  const [isMinimized, setIsMinimized] = useState(false)
  const [position, setPosition] = useState({ x: window.innerWidth - 350, y: 20 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  const audioRef = useRef<HTMLAudioElement>(null)
  const windowRef = useRef<HTMLDivElement>(null)

  // Extract audio from various platforms (simplified for demo)
  const extractAudioUrl = (inputUrl: string): string => {
    const cleanUrl = inputUrl.trim()
    
    // Handle direct audio URLs with various formats
    if (cleanUrl.match(/\.(mp3|wav|ogg|m4a|aac|flac|webm)(\?.*)?$/i)) {
      return cleanUrl
    }
    
    // Handle data URLs for audio
    if (cleanUrl.startsWith('data:audio/')) {
      return cleanUrl
    }
    
    // Handle blob URLs
    if (cleanUrl.startsWith('blob:')) {
      return cleanUrl
    }
    
    // YouTube and other platforms would need backend processing
    if (cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be')) {
      // In production, you'd use youtube-dl or similar service
      return '' // Would need backend service to extract audio
    }
    
    return ''
  }

  const handlePlayPause = async () => {
    if (!audioRef.current || !currentTrack) return
    
    try {
      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        await audioRef.current.play()
        setIsPlaying(true)
      }
    } catch (error) {
      console.error('Audio playback error:', error)
      setIsPlaying(false)
      // Reset current track if it's invalid
      setCurrentTrack('')
    }
  }

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume)
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : newVolume
    }
    onVolumeChange?.(newVolume)
  }

  const handleMuteToggle = () => {
    setIsMuted(!isMuted)
    if (audioRef.current) {
      audioRef.current.volume = !isMuted ? 0 : volume
    }
  }

  const handleLoadTrack = async () => {
    if (!url.trim()) return
    
    try {
      let audioUrl = extractAudioUrl(url)
      
      // If no specific extraction worked, try the URL directly
      if (!audioUrl) {
        audioUrl = url.trim()
      }
      
      if (audioRef.current) {
        // Set up error handling
        const handleLoadError = () => {
          console.error('Failed to load audio:', audioUrl)
          setCurrentTrack('')
        }
        
        const handleCanPlay = () => {
          console.log('Audio loaded successfully')
        }
        
        audioRef.current.addEventListener('error', handleLoadError, { once: true })
        audioRef.current.addEventListener('canplay', handleCanPlay, { once: true })
        
        audioRef.current.src = audioUrl
        audioRef.current.volume = isMuted ? 0 : volume
        
        // Test if the audio can be loaded
        await audioRef.current.load()
        setCurrentTrack(audioUrl)
      }
    } catch (error) {
      console.error('Error loading track:', error)
      setCurrentTrack('')
    }
  }

  // Dragging functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('drag-handle')) {
      setIsDragging(true)
      const rect = windowRef.current?.getBoundingClientRect()
      if (rect) {
        setDragOffset({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        })
      }
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return
    
    setPosition({
      x: Math.max(0, Math.min(window.innerWidth - 320, e.clientX - dragOffset.x)),
      y: Math.max(0, Math.min(window.innerHeight - 200, e.clientY - dragOffset.y))
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, dragOffset])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleEnded = () => setIsPlaying(false)
    const handleError = () => {
      setIsPlaying(false)
      console.error('Audio playback error')
    }

    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [])

  return (
    <div 
      ref={windowRef}
      className="fixed bg-black/90 border border-rust-600/50 rounded-lg backdrop-blur-sm shadow-2xl select-none z-50"
      style={{ 
        left: position.x, 
        top: position.y,
        width: isMinimized ? '200px' : '320px',
        transition: isDragging ? 'none' : 'width 0.3s ease'
      }}
    >
      {/* Title bar */}
      <div 
        className="drag-handle flex items-center justify-between p-2 bg-rust-800/30 rounded-t-lg cursor-move border-b border-rust-600/30"
        onMouseDown={handleMouseDown}
      >
        <div className="text-rust-400 text-xs font-mono">MEDIA_PLAYER.exe</div>
        <div className="flex gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="w-4 h-4 bg-rust-700/50 border border-rust-600/50 rounded text-rust-300 text-xs flex items-center justify-center hover:bg-rust-600/50 transition-colors"
          >
            {isMinimized ? '□' : '_'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className={`p-3 ${isMinimized ? 'hidden' : 'block'}`}>
        {/* URL Input */}
        <div className="mb-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Direct MP3/WAV/OGG URL..."
              className="flex-1 bg-black/30 border border-rust-600/40 rounded px-2 py-1 text-rust-300 text-xs font-mono placeholder-rust-600 focus:outline-none focus:border-rust-500"
            />
            <button
              onClick={handleLoadTrack}
              className="px-2 py-1 bg-rust-800/50 border border-rust-600/50 rounded text-rust-300 text-xs font-mono hover:bg-rust-700/50 transition-colors"
            >
              LOAD
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={handlePlayPause}
            disabled={!currentTrack}
            className={`px-3 py-1 rounded text-xs font-mono transition-colors ${
              currentTrack
                ? 'bg-rust-800/70 border border-rust-600/50 text-rust-300 hover:bg-rust-700/70'
                : 'bg-black/30 border border-rust-800/30 text-rust-700 cursor-not-allowed'
            }`}
          >
            {isPlaying ? '[PAUSE]' : '[PLAY]'}
          </button>

          {/* Mute Button */}
          <button
            onClick={handleMuteToggle}
            className="px-2 py-1 text-xs font-mono bg-black/30 border border-rust-800/30 text-rust-500 hover:bg-rust-800/20 transition-colors"
          >
            {isMuted ? '[MUTED]' : '[AUDIO]'}
          </button>
        </div>

        {/* Current Track Display */}
        {currentTrack && (
          <div className="mt-2 p-2 bg-black/40 border border-rust-700/30 rounded">
            <div className="text-rust-400 text-xs font-mono truncate">
              ♪ {currentTrack.split('/').pop()}
            </div>
          </div>
        )}
      </div>

      {/* Minimized view */}
      {isMinimized && (
        <div className="p-2 flex items-center gap-2">
          <button
            onClick={handlePlayPause}
            disabled={!currentTrack}
            className={`w-6 h-6 rounded text-xs font-mono flex items-center justify-center transition-colors ${
              currentTrack
                ? 'bg-rust-800/70 border border-rust-600/50 text-rust-300 hover:bg-rust-700/70'
                : 'bg-black/30 border border-rust-800/30 text-rust-700 cursor-not-allowed'
            }`}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button
            onClick={handleMuteToggle}
            className="w-6 h-6 rounded text-xs font-mono flex items-center justify-center transition-colors bg-black/30 border border-rust-800/30 text-rust-500 hover:bg-rust-800/20"
          >
            {isMuted ? '🔇' : '🔊'}
          </button>
          {currentTrack && (
            <div className="text-rust-400 text-xs font-mono truncate flex-1">
              ♪ {currentTrack.split('/').pop()?.substring(0, 15)}...
            </div>
          )}
        </div>
      )}

      {/* Hidden audio element */}
      <audio ref={audioRef} />
    </div>
  )
}

export default MediaPlayer
