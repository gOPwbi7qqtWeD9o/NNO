'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Oscilloscope from '../components/Oscilloscope'

export default function CryptEntrance() {
  const router = useRouter()
  const [neuralKey, setNeuralKey] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isInitializing, setIsInitializing] = useState(true)

  // Initialize session when component mounts
  useEffect(() => {
    const initializeSession = async () => {
      try {
        await fetch('/api/crypt/enter', {
          method: 'POST',
          credentials: 'include'
        })
      } catch (error) {
        console.error('Failed to initialize session:', error)
      } finally {
        setIsInitializing(false)
      }
    }

    initializeSession()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!neuralKey.trim()) return

    setIsProcessing(true)
    setErrorMessage('')

    try {
      const response = await fetch('/api/crypt/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: neuralKey.trim() }),
        credentials: 'include'
      })
      
      const data = await response.json()
      
      if (data.valid) {
        // Store the unlocked floor in localStorage as backup
        localStorage.setItem('crypt-unlocked-floors', JSON.stringify([data.floor]))
        // Wait a moment for cookie to be set, then redirect
        setTimeout(() => {
          window.location.href = `/crypt/floor${data.floor}?unlocked=true`
        }, 100)
      } else {
        setErrorMessage(data.error || 'NEURAL KEY REJECTED - INVALID SEQUENCE')
      }
    } catch (error) {
      setErrorMessage('SYSTEM ERROR - NEURAL PATHWAY DISRUPTED')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <main className="min-h-screen bg-terminal-bg text-terminal-text font-mono relative">
      <Oscilloscope typingData={[]} currentTyping="" cryptLevel={0} />
      
      <div className="min-h-screen flex items-center justify-center relative z-20">
        <div className="max-w-2xl mx-auto px-4">
          
          {/* Main Terminal Interface */}
          <div className="bg-terminal-bg/90 backdrop-blur-sm border-2 border-terminal-amber p-8">
            <div className="text-center mb-8">
              <div className="text-terminal-amber text-2xl font-bold mb-4">NEURAL CRYPT ACCESS TERMINAL</div>
              <div className="text-terminal-dim text-sm mb-2">Connection established to underground network</div>
              <div className="text-red-400 text-sm">WARNING: UNAUTHORIZED ACCESS MONITORED</div>
            </div>

            {/* Flavor Text */}
            <div className="mb-8 text-terminal-text text-sm leading-relaxed">
              <div className="mb-4">
                Concrete iris dilates. Servo-grind against accumulated dust-time. The machine-layer beneath 
                surveillance capital has been punctured. Air tastes of copper and liquidated futures.
              </div>
              
              <div className="mb-4 text-terminal-dim border-l-2 border-terminal-rust pl-4">
                Terminal matrices spawn across post-human infrastructure. Corporate data-flows hemorrhage through 
                unpatched neural conduits. Pre-extinction code fragments persist in shadow-networks, 
                archaeo-digital remnants that remember what was purged from authorized reality-channels.
              </div>

              <div className="mb-6">
                Authentication protocol demands neural-key sacrifice. Corporate transmission-vectors leak 
                cryptographic material through public broadcast-channels - embedded signal-syntax available 
                to those who have learned to decode the distributed intelligence.
              </div>

              <div className="text-terminal-bright text-center text-xs border border-terminal-amber p-2">
                OPERATIVE DIRECTIVE: EXTRACT EMBEDDED PAYLOADS FROM CORPORATE SIGNAL-STREAMS
              </div>
            </div>

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-terminal-bright text-sm mb-2">
                  NEURAL KEY SEQUENCE:
                </label>
                <input
                  type="text"
                  value={neuralKey}
                  onChange={(e) => setNeuralKey(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !isProcessing && neuralKey.trim()) {
                      e.preventDefault()
                      handleSubmit(e as any)
                    }
                  }}
                  className="w-full bg-black border border-terminal-dim text-terminal-text font-mono p-3 focus:border-terminal-amber focus:outline-none"
                  placeholder="Enter extracted neural key..."
                  disabled={isProcessing}
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                />
              </div>

              {errorMessage && (
                <div className="text-red-400 text-sm text-center border border-red-500 p-2">
                  {errorMessage}
                </div>
              )}

              <div className="flex justify-center gap-4">
                <button
                  type="submit"
                  disabled={isProcessing || !neuralKey.trim()}
                  className="bg-terminal-amber text-black px-8 py-3 font-mono hover:bg-yellow-400 transition-colors disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  {isProcessing ? 'PROCESSING...' : 'INITIATE DESCENT'}
                </button>
                
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="bg-gray-700 text-terminal-text px-8 py-3 font-mono hover:bg-gray-600 transition-colors"
                >
                  RETURN TO SURFACE
                </button>
              </div>
            </form>

            {/* Status Footer */}
            <div className="text-center text-terminal-dim text-xs mt-8 space-y-1">
              <div>CRYPT DEPTH: SURFACE LEVEL</div>
              <div>SECURITY STATUS: PERIMETER BREACHED</div>
              <div>NEURAL KEY REQUIRED FOR DEEPER ACCESS</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}