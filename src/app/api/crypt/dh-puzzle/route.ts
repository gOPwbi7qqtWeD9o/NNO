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

    // Hardcoded DH parameters for production
    const dhParams = {
      p: '47',
      g: '3',
      A: '36',
      B: '2', 
      hash: '5e5d5f475b5d534a5d5241465f4b4f5452506e7e78667064',
      salt: 'NEURAL_SUBSTRATE_47',
      hint: 'Two synthetic entities perform the ritual of shared computation across neural pathways.'
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