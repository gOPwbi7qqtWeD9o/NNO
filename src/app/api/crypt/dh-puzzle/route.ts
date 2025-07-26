import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    // Get current session
    const session = await getSession()
    
    if (!session || !session.enteredCrypt) {
      return NextResponse.json({ 
        error: 'Neural pathway access denied' 
      }, { status: 401 })
    }

    // Check if Floor 4 was completed (prerequisite for Floor 5)
    if (!session.unlockedFloors.includes(4)) {
      return NextResponse.json({ 
        error: 'Prerequisites not met - complete Floor 4 first' 
      }, { status: 403 })
    }

    // Get DH parameters from environment variables
    const dhParams = {
      p: process.env.DH_PRIME_P || '',
      g: process.env.DH_GENERATOR_G || '',
      A: process.env.DH_ALICE_PUBLIC_A || '',
      B: process.env.DH_BOB_PUBLIC_B || '',
      hash: process.env.DH_SECRET_HASH || '',
      salt: process.env.DH_SECRET_SALT || '',
      hint: process.env.DH_HINT || 'The substrate remembers patterns from its genesis.'
    }

    // Verify all parameters are configured
    if (!dhParams.p || !dhParams.g || !dhParams.A || !dhParams.B || !dhParams.hash || !dhParams.salt) {
      console.error('Missing DH puzzle parameters in environment variables')
      return NextResponse.json({ 
        error: 'Mathematical substrate configuration incomplete' 
      }, { status: 500 })
    }

    return NextResponse.json(dhParams)
    
  } catch (error) {
    console.error('DH puzzle data error:', error)
    return NextResponse.json({ 
      error: 'Neural substrate access failed' 
    }, { status: 500 })
  }
}

// Prevent other HTTP methods
export async function POST() {
  return NextResponse.json({ 
    error: 'Mathematical substrate is read-only' 
  }, { status: 405 })
}