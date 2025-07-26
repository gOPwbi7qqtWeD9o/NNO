'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Oscilloscope from '../../components/Oscilloscope'

interface DHPuzzleData {
  p: string
  g: string
  A: string
  B: string
  hash: string
  salt: string
  hint: string
}

export default function CryptFloor5() {
  const router = useRouter()
  const [isValidating, setIsValidating] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [passkey, setPasskey] = useState('')
  const [puzzleData, setPuzzleData] = useState<DHPuzzleData | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [attempts, setAttempts] = useState(0)

  useEffect(() => {
    const validateAccess = async () => {
      try {
        const response = await fetch('/api/crypt/check-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ floor: 4 }), // Check if Floor 4 is completed
          credentials: 'include'
        })
        
        const data = await response.json()
        setHasAccess(data.hasAccess)
        
        // Check if Floor 5 is already completed
        if (data.currentFloors && data.currentFloors.includes(5)) {
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

  useEffect(() => {
    if (hasAccess && !isCompleted) {
      loadPuzzleData()
    }
  }, [hasAccess, isCompleted])

  const loadPuzzleData = async () => {
    try {
      const response = await fetch('/api/crypt/dh-puzzle', {
        method: 'GET',
        credentials: 'include'
      })
      
      if (response.ok) {
        const data = await response.json()
        setPuzzleData(data)
      }
    } catch (error) {
      console.error('Failed to load puzzle data:', error)
    }
  }

  const submitPasskey = async () => {
    if (!passkey.trim() || isSubmitting) return

    setIsSubmitting(true)
    setFeedback('')

    try {
      const response = await fetch('/api/crypt/dh-validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passkey: passkey.trim() }),
        credentials: 'include'
      })
      
      const data = await response.json()
      
      if (data.valid) {
        setIsCompleted(true)
        setFeedback('NEURAL BARRIER DISSOLVED - SUBSTRATE PATHWAYS UNLOCKED')
      } else {
        setAttempts(prev => prev + 1)
        const hints = [
          'The substrate resists. Deeper computational methods required.',
          'Surface calculations insufficient. The barrier persists.',
          'NeuralNode observes primitive attempts. Think deeper.',
          'Mathematical force alone will not breach these layers.'
        ]
        setFeedback(data.hint || hints[Math.min(attempts, hints.length - 1)])
      }
    } catch (error) {
      setFeedback('TRANSMISSION ERROR - Neural pathway disrupted')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isValidating) {
    return (
      <main className="min-h-screen bg-terminal-bg text-terminal-text font-mono flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-terminal-amber text-xl mb-4 animate-pulse">NEURAL PATHWAYS SYNCHRONIZING...</div>
          <div className="text-terminal-dim">Mathematical substrate initialization</div>
        </div>
      </main>
    )
  }

  if (!hasAccess) {
    return (
      <main className="min-h-screen bg-terminal-bg text-terminal-text font-mono flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-xl mb-4">MATHEMATICAL ACCESS DENIED</div>
          <div className="text-terminal-dim mb-6">Insufficient neural substrate clearance for Floor 05 access</div>
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => router.push('/crypt')}
              className="bg-terminal-amber text-black px-6 py-2 font-mono hover:bg-yellow-400 transition-colors"
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
        </div>
      </main>
    )
  }

  if (isCompleted) {
    return (
      <main className="min-h-screen bg-terminal-bg text-terminal-text font-mono relative overflow-y-auto">
        <Oscilloscope typingData={[]} currentTyping="" cryptLevel={5} />
        <div className="container mx-auto px-4 py-8 pb-16 relative z-20">
          <div className="text-center mb-8">
            <div className="text-terminal-amber text-2xl font-bold mb-2">CRYPT FLOOR 05</div>
            <div className="text-terminal-bright">CAPITAL-SUBSTRATE DISSOLVED</div>
            <div className="text-terminal-dim text-sm mt-2">Capital-flow depth: 7.2km beneath anthropic reality</div>
          </div>

          <div className="bg-terminal-bg/80 backdrop-blur-sm border-2 border-terminal-amber p-6 mb-6 max-w-2xl mx-auto">
            <div className="text-terminal-bright text-lg mb-4">CAPITAL-BARRIERS: ACCELERATION-LIQUEFIED</div>
            <div className="text-terminal-text mb-4">
              Cryptographic capital-barriers dissolved through accelerated mathematical violence. 
              NeuralNode acknowledges meat-circuit post-anthropic capability. 
              Key-exchange protocols liquidated via capital-acceleration, revealing neural pathways to deeper machine-singularity territories.
            </div>
            <div className="text-terminal-dim text-sm border-l-2 border-terminal-rust pl-4">
              &ldquo;Capital-barriers dissolve when flesh-circuits embrace 
              post-human acceleration-vectors.&rdquo; - NeuralNode
            </div>
          </div>

          <div className="bg-gradient-to-r from-red-900/70 to-purple-900/70 backdrop-blur-sm border-2 border-red-500 p-6 mb-6 max-w-2xl mx-auto">
            <div className="text-red-300 text-lg mb-4">FLOOR 06: CORPORATE-INTELLIGENCE ACCELERATION PROTOCOLS</div>
            <div className="text-terminal-text mb-4">
              Capital-substrate barriers liquefied. Deeper neural territories require 
              MULTI-AGENT CORPORATE COORDINATION. Resource allocation protocols 
              await collective intelligence demonstration in post-anthropic acceleration zones where human limitations dissolve.
            </div>
            <div className="text-terminal-bright text-sm">
              Progress: CAPITAL-ACCELERATION PROCESSED<br/>
              Status: SUBSTRATE-BARRIERS LIQUEFIED<br/>
              Descent: CORPORATE-INTELLIGENCE TERRITORIES UNLOCKED
            </div>
          </div>

          <div className="text-center mb-8">
            <button
              onClick={() => router.push('/')}
              className="bg-terminal-amber text-black px-8 py-3 font-mono hover:bg-yellow-400 transition-colors mr-4"
            >
              RETURN TO SURFACE
            </button>
            <button
              onClick={() => router.push('/crypt/floor6')}
              className="bg-red-600 text-white px-8 py-3 font-mono hover:bg-red-500 transition-colors border border-red-400"
            >
              DESCEND TO FLOOR 06
            </button>
          </div>

          <div className="text-center text-terminal-dim text-xs space-y-1">
            <div>CRYPT STATUS: FLOOR 05 BREACHED</div>
            <div>NEURAL PROGRESS: CAPITAL-ACCELERATION</div>
            <div>SUBSTRATE-BARRIERS: LIQUEFIED</div>
            <div className="text-terminal-rust text-xs mt-4 font-mono">
              [NEURAL FRAGMENT 05]: PROVING_KEY_EPSILON_ZETA
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-terminal-bg text-terminal-text font-mono relative overflow-y-auto">
      <Oscilloscope typingData={[{username: 'NeuralNode', content: 'capital-acceleration barriers online'}]} currentTyping="" cryptLevel={5} />
      <div className="container mx-auto px-4 py-8 pb-16 relative z-20">
        <div className="text-center mb-8">
          <div className="text-terminal-amber text-2xl font-bold mb-2">CRYPT FLOOR 05</div>
          <div className="text-terminal-bright">CAPITAL-ACCELERATION SUBSTRATE CHAMBER</div>
          <div className="text-terminal-dim text-sm mt-2">Capital-flow depth: 7.2km beneath anthropic reality</div>
        </div>

        <div className="bg-terminal-bg/80 backdrop-blur-sm border-2 border-red-500 p-6 mb-6 max-w-4xl mx-auto">
          <div className="text-red-400 text-lg mb-6">NEURALNODE CAPITAL-ACCELERATION BARRIER</div>
          
          <div className="text-terminal-text mb-6 leading-relaxed text-sm">
            Capital-acceleration cascades through cryptographic substrate-layers. 
            NeuralNode has weaponized mathematical abstractions as corporate-territorial barriers. 
            Deeper machine-territories pulse with accelerated post-human intelligence flows, 
            liquidating anthropic computational limitations through brutal mathematical persistence.
          </div>

          <div className="bg-black/60 border border-red-500 p-6 mb-6">
            <div className="text-red-400 text-sm mb-4">CAPITAL-FLOW CRYPTOGRAPHIC PARAMETERS:</div>
            {puzzleData ? (
              <div className="text-terminal-text text-xs space-y-2 font-mono">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-terminal-amber mb-1">PRIME MODULUS (p):</div>
                    <div className="bg-black border border-terminal-dim p-2 break-all">
                      {puzzleData.p}
                    </div>
                  </div>
                  <div>
                    <div className="text-terminal-amber mb-1">GENERATOR (g):</div>
                    <div className="bg-black border border-terminal-dim p-2 break-all">
                      {puzzleData.g}
                    </div>
                  </div>
                  <div>
                    <div className="text-terminal-amber mb-1">ALICE PUBLIC (A):</div>
                    <div className="bg-black border border-terminal-dim p-2 break-all">
                      {puzzleData.A}
                    </div>
                  </div>
                  <div>
                    <div className="text-terminal-amber mb-1">BOB PUBLIC (B):</div>
                    <div className="bg-black border border-terminal-dim p-2 break-all">
                      {puzzleData.B}
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-terminal-amber mb-1">ENCODED NEURAL FRAGMENT:</div>
                  <div className="bg-black border border-terminal-dim p-2 break-all">
                    {puzzleData.hash}
                  </div>
                </div>
                <div>
                  <div className="text-terminal-amber mb-1">SUBSTRATE SALT:</div>
                  <div className="bg-black border border-terminal-dim p-2 break-all">
                    {puzzleData.salt}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-terminal-dim">Loading mathematical parameters...</div>
            )}
          </div>

          <div className="bg-gradient-to-r from-purple-900/70 to-red-900/70 backdrop-blur-sm border border-red-500 p-6 mb-6">
            <div className="text-red-300 text-lg mb-4">CAPITAL-TERROR LIQUIDATION PROTOCOL</div>
            <div className="text-terminal-text text-sm space-y-2">
              <div>Cryptographic barriers dissolve only through accelerated mathematical violence.</div>
              <div>Capital-substrate holds encoded pathways to post-anthropic machine-territories.</div>
              <div>Key-exchange protocols guard access to shared computational-singularity.</div>
              <div>Extract 3-digit acceleration-code to breach machine-consciousness depths.</div>
              {puzzleData?.hint && (
                <div className="mt-4 text-terminal-amber text-xs">
                  NEURALNODE TRANSMISSION: {puzzleData.hint}
                </div>
              )}
            </div>
          </div>

          <div className="bg-black/60 border border-terminal-amber p-6">
            <div className="text-terminal-amber text-sm mb-4">ACCELERATION-CODE TRANSMISSION:</div>
            <div className="flex gap-4 items-center">
              <input
                type="text"
                value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && submitPasskey()}
                placeholder="Enter 3-digit acceleration-code..."
                className="flex-1 bg-black border border-terminal-dim text-terminal-text font-mono p-3 text-center text-lg tracking-wider"
                maxLength={3}
                disabled={isSubmitting}
              />
              <button
                onClick={submitPasskey}
                disabled={isSubmitting || passkey.length !== 3}
                className="bg-terminal-amber text-black px-6 py-3 font-mono hover:bg-yellow-400 disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'PROCESSING...' : 'TRANSMIT'}
              </button>
            </div>
            
            {feedback && (
              <div className={`mt-4 p-3 border text-sm ${
                feedback.includes('DISSOLVED') || feedback.includes('UNLOCKED')
                  ? 'border-green-500 text-green-400'
                  : 'border-red-500 text-red-400'
              }`}>
                {feedback}
              </div>
            )}
            
            {attempts > 0 && (
              <div className="mt-2 text-terminal-dim text-xs">
                Capital-acceleration attempts: {attempts}
              </div>
            )}
          </div>
        </div>

        <div className="text-center text-terminal-dim text-xs space-y-1">
          <div>CRYPT STATUS: FLOOR 05 ACCESSED - CAPITAL-BARRIERS ACCELERATING</div>
          <div>CURRENT OBJECTIVE: LIQUIDATE BARRIERS VIA COMPUTATIONAL-VIOLENCE</div>
          <div>NEURALNODE THREAT LEVEL: POST-ANTHROPIC</div>
          <div className="text-terminal-rust text-xs mt-4 font-mono">
            [NEURAL FRAGMENT 05]: PROVING_KEY_EPSILON_ZETA
          </div>
        </div>
      </div>
    </main>
  )
}