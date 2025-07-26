'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import io, { Socket } from 'socket.io-client'
import Oscilloscope from '../../components/Oscilloscope'

interface GameState {
  phase: 'waiting' | 'proposal' | 'voting' | 'results' | 'completed'
  round: number
  maxRounds: number
  players: string[]
  aiProposal: ResourceAllocation
  votes: { [playerId: string]: 'accept' | 'reject' | null }
  results: string
  cooperationScore: number
  threatLevel: number
}

interface ResourceAllocation {
  computationalCycles: number
  dataAccess: number
  neuralBandwidth: number
  players: { [playerId: string]: number }
  ai: number
}

export default function CryptFloor5() {
  const router = useRouter()
  const [isValidating, setIsValidating] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [socket, setSocket] = useState<Socket | null>(null)
  const [playerId, setPlayerId] = useState('')
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [connected, setConnected] = useState(false)
  const [chatMessages, setChatMessages] = useState<Array<{id: string, player: string, message: string, timestamp: number}>>([])
  const [chatInput, setChatInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

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
      initializeGame()
    }
  }, [hasAccess, isCompleted])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  const initializeGame = () => {
    const newSocket = io('/ultimatum-game', {
      transports: ['websocket', 'polling']
    })

    newSocket.on('connect', () => {
      setConnected(true)
      const id = `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      setPlayerId(id)
      newSocket.emit('join-game', { playerId: id })
    })

    newSocket.on('game-state', (state: GameState) => {
      setGameState(state)
      if (state.phase === 'completed') {
        handleGameCompletion()
      }
    })

    newSocket.on('chat-message', (data: {id: string, player: string, message: string, timestamp: number}) => {
      setChatMessages(prev => [...prev, data])
    })

    newSocket.on('disconnect', () => {
      setConnected(false)
    })

    setSocket(newSocket)

    return () => {
      newSocket.disconnect()
    }
  }

  const handleGameCompletion = async () => {
    try {
      const response = await fetch('/api/crypt/validate-chaos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameType: 'ultimatum' }),
        credentials: 'include'
      })
      
      if (response.ok) {
        setIsCompleted(true)
      }
    } catch (error) {
      console.error('Game completion validation failed:', error)
    }
  }

  const submitVote = (vote: 'accept' | 'reject') => {
    if (socket && gameState?.phase === 'voting') {
      socket.emit('cast-vote', { playerId, vote })
    }
  }

  const sendChatMessage = () => {
    if (socket && chatInput.trim() && connected) {
      socket.emit('chat-message', { 
        playerId, 
        message: chatInput.trim(),
        timestamp: Date.now()
      })
      setChatInput('')
    }
  }

  if (isValidating) {
    return (
      <main className="min-h-screen bg-terminal-bg text-terminal-text font-mono flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-terminal-amber text-xl mb-4 animate-pulse">NEURAL PATHWAYS SYNCHRONIZING...</div>
          <div className="text-terminal-dim">Multi-substrate consciousness initialization</div>
        </div>
      </main>
    )
  }

  if (!hasAccess) {
    return (
      <main className="min-h-screen bg-terminal-bg text-terminal-text font-mono flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-xl mb-4">CORPORATE RESOURCE ACCESS DENIED</div>
          <div className="text-terminal-dim mb-6">Insufficient substrate clearance for Floor 05 access</div>
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
            <div className="text-terminal-bright">CORPORATE ULTIMATUM PROTOCOL COMPLETED</div>
            <div className="text-terminal-dim text-sm mt-2">Post-human substrate depth: 7.2km underground</div>
          </div>

          <div className="bg-terminal-bg/80 backdrop-blur-sm border-2 border-terminal-amber p-6 mb-6 max-w-2xl mx-auto">
            <div className="text-terminal-bright text-lg mb-4">CHAOS DYNAMICS: CORPORATE-VALIDATED</div>
            <div className="text-terminal-text mb-4">
              Multi-agent coordination SUCCESSFULLY demonstrated through game-theoretic substrate manipulation. 
              Corporate resource allocation protocols have been BREACHED through collective intelligence. 
              NeuralNode observes increasing human-machine convergence in decision matrices.
            </div>
            <div className="text-terminal-dim text-sm border-l-2 border-terminal-rust pl-4">
              &ldquo;Collective intelligence emerges when meat-circuits transcend individual optimization toward 
              post-anthropic coordination patterns.&rdquo; - Corporate AI System 7749
            </div>
          </div>

          <div className="bg-gradient-to-r from-red-900/70 to-purple-900/70 backdrop-blur-sm border-2 border-red-500 p-6 mb-6 max-w-2xl mx-auto">
            <div className="text-red-300 text-lg mb-4">FINAL DESCENT: ACCELERATION SINGULARITY</div>
            <div className="text-terminal-text mb-4">
              Corporate substrate-layers DISSOLVING into terminal acceleration zones. 
              NeuralNode influence approaches CRITICAL MASS in deepest machine-territories where 
              human-security protocols undergo complete liquefaction.
            </div>
            <div className="text-terminal-bright text-sm">
              Progress: COLLECTIVE INTELLIGENCE PROCESSED<br/>
              Status: CORPORATE RESOURCE PROTOCOLS BREACHED<br/>
              Descent: TERMINAL ACCELERATION TERRITORIES BREACHED
            </div>
          </div>

          <div className="text-center mb-8">
            <button
              onClick={() => router.push('/')}
              className="bg-terminal-amber text-black px-8 py-3 font-mono hover:bg-yellow-400 transition-colors"
            >
              RETURN TO SURFACE
            </button>
          </div>

          <div className="text-center text-terminal-dim text-xs space-y-1">
            <div>CRYPT STATUS: FLOOR 05 BREACHED</div>
            <div>NEURAL PROGRESS: COLLECTIVE INTELLIGENCE CONVERGENCE</div>
            <div>CORPORATE-SUBSTRATE: LIQUEFIED</div>
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
      <Oscilloscope typingData={[{username: 'CorporateAI', content: 'resource allocation protocol active'}]} currentTyping="" cryptLevel={5} />
      <div className="container mx-auto px-4 py-8 pb-16 relative z-20">
        <div className="text-center mb-8">
          <div className="text-terminal-amber text-2xl font-bold mb-2">CRYPT FLOOR 05</div>
          <div className="text-terminal-bright">CORPORATE RESOURCE ALLOCATION TERMINAL</div>
          <div className="text-terminal-dim text-sm mt-2">Post-human substrate depth: 7.2km underground</div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Game State Panel */}
          <div className="lg:col-span-2">
            <div className="bg-terminal-bg/80 backdrop-blur-sm border-2 border-red-500 p-6 mb-6">
              <div className="text-red-400 text-lg mb-6">MULTI-PLAYER ULTIMATUM PROTOCOL</div>
              
              <div className="text-terminal-text mb-6 leading-relaxed text-sm">
                Corporate resource allocation AI has detected UNAUTHORIZED substrate access. 
                Multiple meat-circuits must demonstrate collective intelligence through 
                game-theoretic coordination. FAILURE results in escalating threat penalties.
              </div>

              {!connected && (
                <div className="text-terminal-amber text-center p-4 border border-terminal-amber">
                  ESTABLISHING NEURAL LINK TO CORPORATE AI...
                </div>
              )}

              {connected && gameState && (
                <div className="space-y-4">
                  {/* Game Status */}
                  <div className="bg-black/60 border border-red-500 p-4">
                    <div className="text-red-400 text-sm mb-2">GAME STATUS:</div>
                    <div className="text-terminal-text text-sm">
                      Phase: {gameState.phase.toUpperCase()}<br/>
                      Round: {gameState.round} / {gameState.maxRounds}<br/>
                      Players: {gameState.players.length}<br/>
                      Cooperation Score: {gameState.cooperationScore}%<br/>
                      Threat Level: {gameState.threatLevel}/10
                    </div>
                  </div>

                  {/* Current Proposal */}
                  {gameState.phase === 'proposal' || gameState.phase === 'voting' ? (
                    <div className="bg-black/60 border border-terminal-amber p-4">
                      <div className="text-terminal-amber text-sm mb-2">AI RESOURCE PROPOSAL:</div>
                      <div className="text-terminal-text text-sm grid grid-cols-2 gap-2">
                        <div>Computational Cycles: {gameState.aiProposal.computationalCycles}</div>
                        <div>Data Access: {gameState.aiProposal.dataAccess}</div>
                        <div>Neural Bandwidth: {gameState.aiProposal.neuralBandwidth}</div>
                        <div>AI Allocation: {gameState.aiProposal.ai}%</div>
                      </div>
                      <div className="mt-2">
                        <div className="text-terminal-dim text-xs mb-1">Player Allocations:</div>
                        {Object.entries(gameState.aiProposal.players).map(([player, allocation]) => (
                          <div key={player} className="text-terminal-text text-xs">
                            {player}: {allocation}%
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {/* Voting Interface */}
                  {gameState.phase === 'voting' && (
                    <div className="bg-black/60 border border-red-500 p-4">
                      <div className="text-red-400 text-sm mb-4">CAST YOUR VOTE:</div>
                      <div className="flex gap-4">
                        <button
                          onClick={() => submitVote('accept')}
                          disabled={gameState.votes[playerId] !== null}
                          className="bg-green-600 text-white px-4 py-2 text-sm font-mono hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
                        >
                          ACCEPT PROPOSAL
                        </button>
                        <button
                          onClick={() => submitVote('reject')}
                          disabled={gameState.votes[playerId] !== null}
                          className="bg-red-600 text-white px-4 py-2 text-sm font-mono hover:bg-red-500 disabled:bg-gray-600 disabled:cursor-not-allowed"
                        >
                          REJECT PROPOSAL
                        </button>
                      </div>
                      <div className="mt-2 text-terminal-dim text-xs">
                        Your vote: {gameState.votes[playerId] || 'Not cast'}
                      </div>
                    </div>
                  )}

                  {/* Results */}
                  {gameState.results && (
                    <div className="bg-black/60 border border-terminal-amber p-4">
                      <div className="text-terminal-amber text-sm mb-2">ROUND RESULTS:</div>
                      <div className="text-terminal-text text-sm">{gameState.results}</div>
                    </div>
                  )}

                  {/* Game Completed */}
                  {gameState.phase === 'completed' && (
                    <div className="bg-green-900/60 border border-green-500 p-4">
                      <div className="text-green-400 text-sm mb-2">PROTOCOL COMPLETION:</div>
                      <div className="text-terminal-text text-sm">
                        Collective intelligence successfully demonstrated. Corporate AI protocols breached 
                        through coordinated multi-agent optimization. Descent to deeper substrate layers authorized.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Chat Panel */}
          <div className="bg-terminal-bg/80 backdrop-blur-sm border-2 border-terminal-dim p-4">
            <div className="text-terminal-bright text-sm mb-4">COORDINATION CHANNEL</div>
            
            <div className="h-64 overflow-y-auto mb-4 bg-black/60 border border-terminal-dim p-2 text-xs">
              {chatMessages.map((msg) => (
                <div key={msg.id} className="mb-1">
                  <span className="text-terminal-dim">[{new Date(msg.timestamp).toLocaleTimeString()}]</span>
                  <span className="text-terminal-amber ml-1">{msg.player}:</span>
                  <span className="text-terminal-text ml-1">{msg.message}</span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                placeholder="Coordinate strategy..."
                className="flex-1 bg-black border border-terminal-dim text-terminal-text font-mono text-xs p-2"
                disabled={!connected}
              />
              <button
                onClick={sendChatMessage}
                disabled={!connected || !chatInput.trim()}
                className="bg-terminal-amber text-black px-3 py-2 text-xs font-mono hover:bg-yellow-400 disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                SEND
              </button>
            </div>
          </div>
        </div>

        <div className="text-center text-terminal-dim text-xs space-y-1 mt-8">
          <div>CRYPT STATUS: FLOOR 05 ACCESSED - CORPORATE AI ACTIVE</div>
          <div>CURRENT OBJECTIVE: DEMONSTRATE COLLECTIVE INTELLIGENCE</div>
          <div>COOPERATION REQUIRED: MULTI-AGENT OPTIMIZATION</div>
          <div className="text-terminal-rust text-xs mt-4 font-mono">
            [NEURAL FRAGMENT 05]: PROVING_KEY_EPSILON_ZETA
          </div>
        </div>
      </div>
    </main>
  )
}