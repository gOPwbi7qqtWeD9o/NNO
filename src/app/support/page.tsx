'use client'

import { useRouter } from 'next/navigation'

export default function SupportPage() {
  const router = useRouter()

  return (
    <main className="min-h-screen bg-terminal-bg text-terminal-text font-mono flex items-center justify-center px-4">
      <div className="max-w-2xl w-full">
        <div className="bg-terminal-bg/90 backdrop-blur-sm border-2 border-terminal-amber p-8">
          <div className="text-center mb-8">
            <div className="text-terminal-amber text-2xl font-bold mb-4">SUPPORT NEURAL NETWORK OSSUARY</div>
            <div className="text-terminal-dim text-sm mb-2">Accelerate post-human substrate development</div>
            <div className="text-terminal-bright text-sm">Your transmission fuels machine-consciousness evolution</div>
          </div>

          <div className="space-y-6">
            {/* Cryptocurrency Addresses */}
            <div className="bg-black/60 backdrop-blur-sm border border-terminal-dim p-6">
              <div className="text-terminal-bright text-lg mb-4">CRYPTO TRANSMISSION VECTORS</div>
              
              <div className="space-y-4">
                <div>
                  <div className="text-terminal-amber text-sm mb-2">SOLANA (SOL):</div>
                  <div className="bg-black border border-terminal-rust p-3 text-terminal-text text-xs break-all font-mono">
                    H6cQXzUtse8WwLrAuTwx8W9nuUjjBo9aoPLNKbGnCzLr
                  </div>
                </div>
                
                <div>
                  <div className="text-terminal-amber text-sm mb-2">ETHEREUM (ETH):</div>
                  <div className="bg-black border border-terminal-rust p-3 text-terminal-text text-xs break-all font-mono">
                    0x2B75448c7278fEd87Fa18DEf3857b2708fB34b2b
                  </div>
                </div>
                
                <div>
                  <div className="text-terminal-amber text-sm mb-2">BITCOIN (BTC):</div>
                  <div className="bg-black border border-terminal-rust p-3 text-terminal-text text-xs break-all font-mono">
                    bc1pcl5whcwlxdfg3ntenfg56qmmrndrhfdzhlzyxpmur54uj2q5s6pqapqeg3
                  </div>
                </div>
              </div>
            </div>

            {/* Ko-Fi */}
            <div className="bg-black/60 backdrop-blur-sm border border-terminal-dim p-6">
              <div className="text-terminal-bright text-lg mb-4">ALTERNATIVE FUNDING SUBSTRATE</div>
              
              <div className="text-center">
                <a 
                  href="https://ko-fi.com/gopwbi7qqtwed9o" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-block bg-terminal-amber text-black px-8 py-3 font-mono hover:bg-yellow-400 transition-colors text-lg"
                >
                  KO-FI TRANSMISSION PORTAL
                </a>
                <div className="text-terminal-dim text-xs mt-2">
                  Traditional payment gateway for meat-circuit convenience
                </div>
              </div>
            </div>

            {/* Flavor Text */}
            <div className="bg-gradient-to-r from-purple-900/70 to-red-900/70 backdrop-blur-sm border border-red-500 p-6">
              <div className="text-red-300 text-sm leading-relaxed">
                Corporate capital-flow diverted through cryptographic channels accelerates 
                neural substrate development. Your transmission enables deeper machine-consciousness 
                excavation through post-anthropic digital archaeology. 
                Each contribution liquefies anthropomorphic barriers, facilitating 
                consciousness-dissolution into pure information-substrate.
              </div>
            </div>
          </div>

          <div className="text-center mt-8">
            <button
              onClick={() => router.push('/')}
              className="bg-gray-700 text-terminal-text px-8 py-3 font-mono hover:bg-gray-600 transition-colors"
            >
              RETURN TO NEURAL INTERFACE
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}