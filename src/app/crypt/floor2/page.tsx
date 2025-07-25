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
          <div className="text-terminal-dim">Quantum encryption protocols loading</div>
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
            <div className="text-terminal-bright text-lg mb-4">DECRYPTION PROTOCOL: SUCCESSFUL</div>
            <div className="text-terminal-text mb-4">
              The neural pathways have acknowledged your cryptographic expertise. Corporate transmission 
              patterns yield their secrets to those who understand the old communication protocols. 
              Deeper access levels await, but the quantum barriers grow exponentially more complex.
            </div>
            <div className="text-terminal-dim text-sm border-l-2 border-terminal-rust pl-4">
              &ldquo;The corporate veil thins with each layer pierced. The deep vaults remember what 
              they tried to encrypt away from us all.&rdquo; Corbusier
            </div>
          </div>

          {/* Floor 3 Status */}
          <div className="bg-black/70 backdrop-blur-sm border-2 border-red-500 p-6 mb-6 max-w-2xl mx-auto">
            <div className="text-red-400 text-lg mb-4">FLOOR 03: QUANTUM CORE SEALED</div>
            <div className="text-terminal-text mb-4">
              The neural crypt&apos;s quantum core remains locked behind advanced cryptographic protocols. 
              Access requires possession of OMEGA-LEVEL clearance and completion of quantum proof systems.
            </div>
            <div className="text-terminal-dim text-sm">
              Clearance Level Required: OMEGA-9<br/>
              Current Authorization: SIGMA-7<br/>
              Status: QUANTUM BARRIERS ACTIVE
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
              disabled
              className="bg-gray-700 text-gray-500 px-8 py-3 font-mono cursor-not-allowed border border-gray-600"
            >
              DESCEND TO FLOOR 03 [LOCKED]
            </button>
          </div>

          {/* Status Footer */}
          <div className="text-center text-terminal-dim text-xs space-y-1">
            <div>CRYPT STATUS: FLOOR 02 BREACHED</div>
            <div>NEXT OBJECTIVE: LOCATE FLOOR 03 QUANTUM KEY</div>
            <div>CORPORATE THREAT LEVEL: MAXIMUM</div>
            <div className="text-terminal-rust text-xs mt-4 font-mono">
              [NEURAL FRAGMENT 02]: WITNESS_TEMPLATE_POSEIDON
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
            The neural pathways descend deeper into corporate infrastructure. Ancient data conduits 
            hum with encrypted transmissions, their patterns obscured by layers of corporate security. 
            The deeper vaults await those who can decipher the old communication protocols.
          </div>

          {/* Encrypted Data Display */}
          <div className="bg-black/60 border border-terminal-rust p-6 mb-8">
            <div className="text-terminal-rust text-sm mb-4">NEURAL ACCESS KEY:</div>
            <div className="font-mono text-terminal-amber text-2xl tracking-wider text-center py-4">
              75319~248a
            </div>
          </div>

          <div className="text-terminal-dim text-sm mb-8 text-center">
            The old networks remember their syntax. Corporate transmissions echo through forgotten channels.
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

        {/* Floor 3 Preview */}
        <div className="bg-black/70 backdrop-blur-sm border-2 border-red-500 p-6 mb-6 max-w-4xl mx-auto">
          <div className="text-red-400 text-lg mb-4">FLOOR 03: NEURAL CORE ACCESS RESTRICTED</div>
          <div className="text-terminal-text mb-4">
            The deepest level of the neural crypt remains sealed behind quantum-encrypted barriers. 
            Access requires completion of advanced cryptographic protocols and possession of 
            OMEGA-LEVEL clearance credentials.
          </div>
          <div className="text-terminal-dim text-sm">
            Clearance Level Required: OMEGA-9<br/>
            Current Authorization: SIGMA-7<br/>
            Status: CORE PROTOCOLS LOCKED
          </div>
        </div>

        {/* Status Footer */}
        <div className="text-center text-terminal-dim text-xs space-y-1">
          <div>CRYPT STATUS: FLOOR 02 ACCESSED</div>
          <div>CURRENT OBJECTIVE: DECRYPT NEURAL ACCESS SEQUENCE</div>
          <div>CORPORATE THREAT LEVEL: CRITICAL</div>
          <div className="text-terminal-rust text-xs mt-4 font-mono">
            [NEURAL FRAGMENT 02]: WITNESS_TEMPLATE_POSEIDON
          </div>
        </div>
      </div>
    </main>
  )
}