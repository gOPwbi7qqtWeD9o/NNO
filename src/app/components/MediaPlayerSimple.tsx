import React from 'react'

interface MediaPlayerProps {
  onVolumeChange?: (volume: number) => void
}

const MediaPlayerSimple: React.FC<MediaPlayerProps> = ({ onVolumeChange }) => {
  return (
    <div className="fixed top-4 left-4 z-40 bg-black/80 backdrop-blur-sm rounded-lg border border-terminal-rust/50 p-3">
      <div className="text-terminal-text text-sm">Media Player (Simplified)</div>
    </div>
  )
}

export default MediaPlayerSimple
