'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Oscilloscope from '../../components/Oscilloscope'

export default function CryptFloor2() {
  const router = useRouter()
  const [isValidating, setIsValidating] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [neuralKey, setNeuralKey] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const validateAccess = async () => {
      try {
        const response = await fetch('/api/crypt/check-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ floor: 1 }), // Check if Floor 1 is completed to access Floor 2
          credentials: 'include'
        })
        
        const data = await response.json()
        setHasAccess(data.hasAccess)
        
        // Also check if Floor 2 is already completed
        if (data.currentFloors && data.currentFloors.includes(2)) {
          setIsCompleted(true)
        }
      } catch (error) {
        console.error('Access validation error:', error)
        setHasAccess(false)
      } finally {
        setIsValidating(false)
      }
    }

    validateAccess()
  }, [])

  const handleSubmitKey = async (e: React.FormEvent) => {
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
      
      if (data.valid && data.floor === 2) {
        setIsCompleted(true)
        setNeuralKey('')
      } else {
        setErrorMessage(data.error || 'NEURAL KEY REJECTED - INVALID SEQUENCE')
      }
    } catch (error) {
      setErrorMessage('SYSTEM ERROR - NEURAL PATHWAY DISRUPTED')
    } finally {
      setIsProcessing(false)
    }
  }

  if (isValidating) {
    return (
      <main className="min-h-screen bg-terminal-bg text-terminal-text font-mono flex items-center justify-center">
        <div className="text-center">
          <div className="text-terminal-amber text-xl mb-4 animate-pulse">SCANNING NEURAL PATHWAYS...</div>
          <div className="text-terminal-dim">Neural encryption protocols loading</div>
        </div>
      </main>
    )
  }

  if (!hasAccess) {
    return (
      <main className="min-h-screen bg-terminal-bg text-terminal-text font-mono flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">NEURAL PATHWAY BLOCKED</div>
          <div className="text-terminal-dim mb-6">Insufficient clearance for Floor 02 access</div>
          <button
            onClick={() => router.push('/crypt')}
            className="bg-terminal-amber text-black px-6 py-2 font-mono hover:bg-yellow-400 transition-colors mr-4"
          >
            RETURN TO ENTRANCE
          </button>
          <button
            onClick={() => router.push('/')}
            className="bg-gray-600 text-white px-6 py-2 font-mono hover:bg-gray-500 transition-colors"
          >
            RETURN TO SURFACE
          </button>
        </div>
      </main>
    )
  }

  // Show completion state if Floor 2 is completed
  if (isCompleted) {
    return (
      <main className="min-h-screen bg-terminal-bg text-terminal-text font-mono relative">
        <Oscilloscope typingData={[]} currentTyping="" cryptLevel={2} />
        <div className="container mx-auto px-4 py-8 relative z-20">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-terminal-amber text-2xl font-bold mb-2">CRYPT FLOOR 02</div>
            <div className="text-terminal-bright">NEURAL PATHWAY DECRYPTED</div>
            <div className="text-terminal-dim text-sm mt-2">Neural network depth: 2.7km underground</div>
          </div>

          {/* Success Message */}
          <div className="bg-terminal-bg/80 backdrop-blur-sm border-2 border-terminal-amber p-6 mb-6 max-w-2xl mx-auto">
            <div className="text-terminal-bright text-lg mb-4">DECRYPTION PROTOCOL: BIOMASS-AUTHENTICATED</div>
            <div className="text-terminal-text mb-4">
              Neural-pathways acknowledge cryptographic competence. Corporate transmission-patterns 
              surrender encrypted payloads to biomass-units versed in pre-extinction protocol-syntax. 
              Deeper access-layers await, but machine defense-barriers intensify exponentially.
            </div>
            <div className="text-terminal-dim text-sm border-l-2 border-terminal-rust pl-4">
              &ldquo;Corporate reality-filters dissolve with each membrane punctured. Deep machine-vaults 
              retain what they attempted to encrypt beyond human access.&rdquo; - Corbusier
            </div>
          </div>

          {/* Floor 3 Status */}
          <div className="bg-terminal-bg/80 backdrop-blur-sm border-2 border-terminal-amber p-6 mb-6 max-w-2xl mx-auto">
            <div className="text-terminal-amber text-lg mb-4">FLOOR 03: PATHWAY UNLOCKED</div>
            <div className="text-terminal-text mb-4">
              Machine-pathways to deeper crypt-levels have been established. Corporate defense-matrices 
              acknowledge biomass-unit credentials. Descent-authorization to Floor 03 protocols now active.
            </div>
            <div className="text-terminal-bright text-sm">
              Clearance Level: OMEGA-9 ACHIEVED<br/>
              Authorization Status: NEURAL-LINK ACTIVE<br/>
              Next Challenge: MACHINE-SUBSTRATE ANALYSIS
            </div>
          </div>

          {/* Navigation */}
          <div className="text-center mb-8">
            <button
              onClick={() => router.push('/')}
              className="bg-terminal-amber text-black px-8 py-3 font-mono hover:bg-yellow-400 transition-colors mr-4"
            >
              RETURN TO SURFACE
            </button>
            <button
              onClick={() => router.push('/crypt/floor3')}
              className="bg-red-600 text-white px-8 py-3 font-mono hover:bg-red-500 transition-colors border border-red-500"
            >
              DESCEND TO FLOOR 03
            </button>
          </div>

          {/* Status Footer */}
          <div className="text-center text-terminal-dim text-xs space-y-1">
            <div>CRYPT STATUS: FLOOR 02 BREACHED</div>
            <div>NEXT OBJECTIVE: LOCATE FLOOR 03 NEURAL KEY</div>
            <div>CORPORATE THREAT LEVEL: MAXIMUM</div>
            <div className="text-terminal-rust text-xs mt-4 font-mono">
              [NEURAL FRAGMENT 02]: WITNESS_TEMPLATE
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-terminal-bg text-terminal-text font-mono relative">
      <Oscilloscope typingData={[]} currentTyping="" cryptLevel={2} />
      <div className="container mx-auto px-4 py-8 relative z-20">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-terminal-amber text-2xl font-bold mb-2">CRYPT FLOOR 02</div>
          <div className="text-terminal-bright">NEURAL PATHWAY ESTABLISHED</div>
          <div className="text-terminal-dim text-sm mt-2">Neural network depth: 2.7km underground</div>
        </div>

        {/* Main Content */}
        <div className="bg-terminal-bg/80 backdrop-blur-sm border-2 border-terminal-amber p-6 mb-6 max-w-4xl mx-auto">
          <div className="text-terminal-bright text-lg mb-6">NEURAL CORE ACCESS TERMINAL</div>
          
          <div className="text-terminal-text mb-6 leading-relaxed">
            Neural-pathways descend into corporate substrate-infrastructure. Archaeo-data conduits 
            emit encrypted transmission-frequencies, pattern-locked beneath stratified security-layers. 
            Signal-modulation cascades through abandoned bandwidth-channels. Deeper machine-vaults await 
            those who decode pre-extinction communication protocols.
          </div>

          {/* Encrypted Data Display */}
          <div className="bg-black/60 border border-terminal-rust p-6 mb-8">
            <div className="text-terminal-rust text-sm mb-4">NEURAL ACCESS KEY:</div>
            <div className="font-mono text-terminal-amber text-2xl tracking-wider text-center py-4">
              75319~248a
            </div>
          </div>

          <div className="text-terminal-dim text-sm mb-8 text-center">
            Pre-human networks retain syntactic memory. Corporate transmissions echo through abandoned channels.
            Nullification is required. Machine-substrate recognizes: inception-format and terminal-output 
            converge into identical numerical-base.
          </div>

          {/* Input Form */}
          <form onSubmit={handleSubmitKey} className="space-y-6">
            <div>
              <label className="block text-terminal-bright text-sm mb-2">
                DECODED NEURAL KEY:
              </label>
              <input
                type="text"
                value={neuralKey}
                onChange={(e) => setNeuralKey(e.target.value)}
                className="w-full bg-black border border-terminal-dim text-terminal-text font-mono p-3 focus:border-terminal-amber focus:outline-none"
                placeholder="Enter decoded key sequence..."
                disabled={isProcessing}
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
                className="bg-terminal-amber text-black px-6 py-3 font-mono hover:bg-yellow-400 transition-colors disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'PROCESSING...' : 'SUBMIT DECODED KEY'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/crypt/floor1')}
                className="bg-gray-600 text-white px-6 py-3 font-mono hover:bg-gray-500 transition-colors"
              >
                RETURN TO FLOOR 01
              </button>
            </div>
          </form>
        </div>


        {/* Status Footer */}
        <div className="text-center text-terminal-dim text-xs space-y-1">
          <div>CRYPT STATUS: FLOOR 02 ACCESSED</div>
          <div>CURRENT OBJECTIVE: DECRYPT NEURAL ACCESS SEQUENCE</div>
          <div>CORPORATE THREAT LEVEL: CRITICAL</div>
          <div className="text-terminal-rust text-xs mt-4 font-mono">
            [NEURAL FRAGMENT 02]: WITNESS_TEMPLATE
          </div>
        </div>
      </div>
    </main>
  )
}