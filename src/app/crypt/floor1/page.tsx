'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Oscilloscope from '../../components/Oscilloscope'

export default function CryptFloor1() {
  const router = useRouter()
  const [isValidating, setIsValidating] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    const validateAccess = async () => {
      try {
        const response = await fetch('/api/crypt/check-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ floor: 1 }),
          credentials: 'include'
        })
        
        const data = await response.json()
        setHasAccess(data.hasAccess)
      } catch (error) {
        console.error('Access validation error:', error)
        setHasAccess(false)
      } finally {
        setIsValidating(false)
      }
    }

    validateAccess()
  }, [])

  if (isValidating) {
    return (
      <main className="min-h-screen bg-terminal-bg text-terminal-text font-mono flex items-center justify-center">
        <div className="text-center">
          <div className="text-terminal-amber text-xl mb-4 animate-pulse">VALIDATING NEURAL PATHWAY...</div>
          <div className="text-terminal-dim">Quantum decryption in progress</div>
        </div>
      </main>
    )
  }

  if (!hasAccess) {
    return (
      <main className="min-h-screen bg-terminal-bg text-terminal-text font-mono flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">ACCESS DENIED</div>
          <div className="text-terminal-dim mb-6">Neural pathway not established</div>
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

  return (
    <main className="min-h-screen bg-terminal-bg text-terminal-text font-mono relative">
      <Oscilloscope typingData={[]} currentTyping="" cryptLevel={1} />
      <div className="container mx-auto px-4 py-8 relative z-20">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-terminal-amber text-2xl font-bold mb-2">CRYPT FLOOR 01</div>
          <div className="text-terminal-bright">ACCESS GRANTED</div>
          <div className="text-terminal-dim text-sm mt-2">Neural network depth: 1.2km underground</div>
        </div>

        {/* Success Message */}
        <div className="bg-terminal-bg/80 backdrop-blur-sm border-2 border-terminal-amber p-6 mb-6 max-w-2xl mx-auto">
          <div className="text-terminal-bright text-lg mb-4">OPERATIVE STATUS: VERIFIED</div>
          <div className="text-terminal-text mb-4">
            Your extraction protocols have successfully breached the outer shell of the neural crypt. 
            The data streams whisper of deeper mysteries below, but the corporate firewalls grow stronger 
            with each descending floor.
          </div>
          <div className="text-terminal-dim text-sm border-l-2 border-terminal-rust pl-4">
            &ldquo;The old networks remember what Corporate tried to delete. Every bit, every fragment of the 
            truth they buried still echoes in the deep vaults.&rdquo; - NodePriest
          </div>
        </div>

        {/* Floor 2 Status */}
        <div className="bg-black/70 backdrop-blur-sm border-2 border-red-500 p-6 mb-6 max-w-2xl mx-auto">
          <div className="text-red-400 text-lg mb-4">FLOOR 02: SEALED</div>
          <div className="text-terminal-text mb-4">
            The descent pathway remains locked behind quantum encryption barriers. 
            Additional neural keys must be discovered to penetrate deeper into the crypt&apos;s core.
          </div>
          <div className="text-terminal-dim text-sm">
            Clearance Level Required: SIGMA-7<br/>
            Current Authorization: BASIC-ACCESS<br/>
            Status: INSUFFICIENT PRIVILEGES
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
            DESCEND TO FLOOR 02 [LOCKED]
          </button>
        </div>

        {/* Status Footer */}
        <div className="text-center text-terminal-dim text-xs space-y-1">
          <div>CRYPT STATUS: FLOOR 01 BREACHED</div>
          <div>NEXT OBJECTIVE: LOCATE FLOOR 02 NEURAL KEY</div>
          <div>CORPORATE THREAT LEVEL: ELEVATED</div>
        </div>
      </div>
    </main>
  )
}