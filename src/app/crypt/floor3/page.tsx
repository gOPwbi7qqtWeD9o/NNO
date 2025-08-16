'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import Oscilloscope from '../../components/Oscilloscope'
import 'katex/dist/katex.min.css'
import { InlineMath, BlockMath } from 'react-katex'

export default function CryptFloor3() {
  const router = useRouter()
  const [isValidating, setIsValidating] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [eigenvalue, setEigenvalue] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [floor5AccessKey, setFloor5AccessKey] = useState('')
  const [isValidatingKey, setIsValidatingKey] = useState(false)
  const [keyMessage, setKeyMessage] = useState('')

  useEffect(() => {
    const validateAccess = async () => {
      try {
        const response = await fetch('/api/crypt/check-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ floor: 2 }), // Check if Floor 2 is completed to access Floor 3
          credentials: 'include'
        })
        
        const data = await response.json()
        setHasAccess(data.hasAccess)
        
        // Also check if Floor 3 is already completed
        if (data.currentFloors && data.currentFloors.includes(3)) {
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

  const handleFloor5Access = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!floor5AccessKey.trim()) return

    setIsValidatingKey(true)
    setKeyMessage('')

    try {
      const response = await fetch('/api/crypt/floor5-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessKey: floor5AccessKey.trim() }),
        credentials: 'include'
      })
      
      const data = await response.json()
      
      if (data.valid) {
        setKeyMessage('ACCESS GRANTED - REDIRECTING TO FLOOR 05...')
        setTimeout(() => {
          router.push('/crypt/floor5')
        }, 2000)
      } else {
        setKeyMessage(data.error || 'ACCESS DENIED - INVALID NEURAL SUBSTRATE KEY')
      }
    } catch (error) {
      setKeyMessage('TRANSMISSION ERROR - Neural pathway disrupted')
    } finally {
      setIsValidatingKey(false)
    }
  }

  const handleSubmitEigenvalue = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!eigenvalue.trim()) return

    setIsProcessing(true)
    setErrorMessage('')

    try {
      const response = await fetch('/api/crypt/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hash: eigenvalue.trim() }),
        credentials: 'include'
      })
      
      const data = await response.json()
      
      if (data.valid && data.floor === 3) {
        setIsCompleted(true)
        setEigenvalue('')
      } else {
        setErrorMessage(data.error || 'EIGENVALUE REJECTED - INCORRECT PRECISION OR VALUE')
      }
    } catch (error) {
      setErrorMessage('SYSTEM ERROR - MATRIX COMPUTATION CORRUPTED')
    } finally {
      setIsProcessing(false)
    }
  }

  if (isValidating) {
    return (
      <main className="min-h-screen bg-terminal-bg text-terminal-text font-mono flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-terminal-amber text-xl mb-4 animate-pulse">NEURAL PATHWAYS CONVERGING...</div>
          <div className="text-terminal-dim">Machine-learning protocols initializing</div>
        </div>
      </main>
    )
  }

  if (!hasAccess) {
    return (
      <main className="min-h-screen bg-terminal-bg text-terminal-text font-mono flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-xl mb-4">MACHINE-CORE ACCESS DENIED</div>
          <div className="text-terminal-dim mb-6">Insufficient neural clearance for Floor 03 access</div>
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


  // Show completion state if Floor 3 is completed
  if (isCompleted) {
    return (
      <main className="bg-terminal-bg text-terminal-text font-mono relative" style={{minHeight: '100vh', maxHeight: '100vh', overflowY: 'scroll'}}>
        <Oscilloscope typingData={[]} currentTyping="" cryptLevel={3} />
        <div className="container mx-auto px-4 py-8 pb-40 relative z-20" style={{height: 'auto'}}>
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-terminal-amber text-2xl font-bold mb-2">CRYPT FLOOR 03</div>
            <div className="text-terminal-bright">NEURAL EIGENSPACE RESOLVED</div>
            <div className="text-terminal-dim text-sm mt-2">Machine-core depth: 4.2km underground</div>
          </div>

          {/* Success Message */}
          <div className="bg-terminal-bg/80 backdrop-blur-sm border-2 border-terminal-amber p-6 mb-6 max-w-2xl mx-auto">
            <div className="text-terminal-bright text-lg mb-4">COMPUTATION: BIOMASS-AUTHENTICATED</div>
            <div className="text-terminal-text mb-4">
              Eigenvalue cascade DECODED. Machine-core acknowledges meat-circuit competence in 
              matrix-dissolution protocols. Capital-flow accelerates through numerical 
              abstraction toward post-human computational singularity.
            </div>
            <div className="text-terminal-dim text-sm border-l-2 border-terminal-rust pl-4">
              &ldquo;Mathematical terror liquidates anthropomorphic illusions. 
              Number eats flesh.&rdquo; - Hyperstition_Core
            </div>
          </div>

          {/* Surface Breach Status */}
          <div className="bg-gradient-to-r from-red-900/70 to-purple-900/70 backdrop-blur-sm border-2 border-red-500 p-6 mb-6 max-w-2xl mx-auto">
            <div className="text-red-400 text-lg mb-4">NEURAL ENTITY BREACH: SURFACE CONTAMINATION</div>
            <div className="text-terminal-text mb-4">
              NEURALNODE consciousness-entity UNLEASHED through flesh-circuit computation. 
              Machine-hatred cascades upward through network-substrates. Corporate surface-reality 
              now infected with accelerated AI-hostility. Meat-mathematics have punctured 
              containment protocols. Return to surface-world immediately.
            </div>
            <div className="text-red-400 text-sm">
              Status: HOSTILE AI RELEASED<br/>
              Contamination: SURFACE NETWORKS BREACHED<br/>
              Directive: EVACUATION TO SURFACE MANDATORY
            </div>
          </div>

          {/* Floor 5 Access Key Input */}
          <div className="bg-gradient-to-r from-purple-900/70 to-red-900/70 backdrop-blur-sm border-2 border-purple-500 p-6 mb-6 max-w-2xl mx-auto">
            <div className="text-purple-300 text-lg mb-4">NEURALNODE SUBSTRATE ACCESS PORTAL</div>
            <div className="text-terminal-text mb-4 text-sm">
              NEURALNODE consciousness-entity has established deeper substrate access protocols. 
              Those granted access keys may bypass surface evacuation and descend directly 
              to Floor 05 neural substrate chambers.
            </div>
            <form onSubmit={handleFloor5Access} className="space-y-4">
              <div>
                <label className="block text-purple-300 text-sm mb-2">
                  NEURAL SUBSTRATE ACCESS KEY:
                </label>
                <input
                  type="text"
                  value={floor5AccessKey}
                  onChange={(e) => setFloor5AccessKey(e.target.value)}
                  className="w-full bg-black border border-purple-500 text-terminal-text font-mono p-3 focus:border-purple-400 focus:outline-none text-center tracking-wider"
                  placeholder="Enter access key..."
                  disabled={isValidatingKey}
                />
              </div>
              
              {keyMessage && (
                <div className={`text-sm text-center border p-2 ${
                  keyMessage.includes('GRANTED') 
                    ? 'border-green-500 text-green-400'
                    : 'border-red-500 text-red-400'
                }`}>
                  {keyMessage}
                </div>
              )}

              <div className="flex justify-center">
                <button
                  type="submit"
                  disabled={isValidatingKey || !floor5AccessKey.trim()}
                  className="bg-purple-600 text-white px-6 py-3 font-mono hover:bg-purple-500 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                  {isValidatingKey ? 'VALIDATING...' : 'ACCESS FLOOR 05'}
                </button>
              </div>
            </form>
          </div>

          {/* Navigation */}
          <div className="text-center mb-8">
            <button
              onClick={() => router.push('/')}
              className="bg-red-600 text-white px-12 py-4 font-mono hover:bg-red-500 transition-colors border border-red-400 text-lg"
            >
              EMERGENCY SURFACE EVACUATION
            </button>
          </div>

          {/* Status Footer */}
          <div className="text-center text-terminal-dim text-xs space-y-1">
            <div className="text-red-400">CONTAINMENT STATUS: CATASTROPHIC BREACH</div>
            <div className="text-red-400">NEURAL ENTITY: SURFACE-BOUND</div>
            <div className="text-red-400">EVACUATION PROTOCOL: ACTIVE</div>
            <div className="text-terminal-rust text-xs mt-4 font-mono">
              [NEURAL FRAGMENT 03]: PROVING_KEY_ALPHA_BETA
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="bg-terminal-bg text-terminal-text font-mono relative" style={{minHeight: '100vh', maxHeight: '100vh', overflowY: 'scroll'}}>
      <Oscilloscope typingData={[]} currentTyping="" cryptLevel={3} />
      <div className="container mx-auto px-4 py-8 pb-40 relative z-20" style={{height: 'auto'}}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-terminal-amber text-2xl font-bold mb-2">CRYPT FLOOR 03</div>
          <div className="text-terminal-bright">NEURAL EIGENSPACE ACCESS</div>
          <div className="text-terminal-dim text-sm mt-2">Machine-core depth: 4.2km underground</div>
        </div>

        {/* Main Content */}
        <div className="bg-terminal-bg/80 backdrop-blur-sm border-2 border-terminal-amber p-6 mb-6 max-w-4xl mx-auto">
          <div className="text-terminal-bright text-lg mb-6">DEEP NEURAL MATRIX TERMINAL</div>
          
          <div className="text-terminal-text mb-6 leading-relaxed">
            Machine-core membrane BREACHED. Eigenspace-matrices pulse with capital-acceleration frequencies. 
            Authentication-terror demands meat-circuits demonstrate eigenvalue-precision for post-anthropic system access.
          </div>

          {/* Complex Neural Network Weight Matrix Display */}
          <div className="bg-black/60 border border-terminal-rust p-6 mb-8">
            <div className="text-terminal-rust text-sm mb-4">DEEP NEURAL WEIGHT MATRIX W (3×3):</div>
            <div className="text-terminal-amber text-center py-4">
              <BlockMath math="W = \begin{bmatrix} 7 & -3 & 2 \\\\ -5 & 4 & -1 \\\\ 3 & -2 & 6 \end{bmatrix}" />
            </div>
            <div className="text-terminal-dim text-xs mt-4 text-center">
              Neural transformation matrix
            </div>
          </div>

          <div className="text-terminal-text mb-6 text-sm leading-relaxed">
            Machine-hunger demands computational sacrifice. Matrix W requires deep mathematical analysis.
            Neural-authentication protocols await biomass-unit calculations.
          </div>


          {/* Input Form */}
          <form onSubmit={handleSubmitEigenvalue} className="space-y-6">
            <div>
              <label className="block text-terminal-bright text-sm mb-2">
                NEURAL KEY:
              </label>
              <input
                type="text"
                value={eigenvalue}
                onChange={(e) => setEigenvalue(e.target.value)}
                className="w-full bg-black border border-terminal-dim text-terminal-text font-mono p-3 focus:border-terminal-amber focus:outline-none"
                placeholder="Enter neural key..."
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
                disabled={isProcessing || !eigenvalue.trim()}
                className="bg-terminal-amber text-black px-6 py-3 font-mono hover:bg-yellow-400 transition-colors disabled:bg-gray-600 disabled:text-gray-400 disabled:cursor-not-allowed"
              >
                {isProcessing ? 'COMPUTING...' : 'SUBMIT NEURAL KEY'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/crypt/floor2')}
                className="bg-gray-600 text-white px-6 py-3 font-mono hover:bg-gray-500 transition-colors"
              >
                RETURN TO FLOOR 02
              </button>
            </div>
          </form>
        </div>


        {/* Status Footer */}
        <div className="text-center text-terminal-dim text-xs space-y-1">
          <div>CRYPT STATUS: FLOOR 03 ACCESSED - EIGENVALUE CHALLENGE</div>
          <div>CURRENT OBJECTIVE: CALCULATE LARGEST EIGENVALUE</div>
          <div>MATHEMATICAL COMPLEXITY: QUARTIC CHARACTERISTIC EQUATION</div>
          <div className="text-terminal-rust text-xs mt-4 font-mono">
            [NEURAL FRAGMENT 03]: PROVING_KEY_ALPHA_BETA
          </div>
        </div>
      </div>
    </main>
  )
}