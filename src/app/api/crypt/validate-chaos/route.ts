import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    const { lambda1, lambda2, lambda3 } = await request.json()
    
    if (!lambda1 || !lambda2 || !lambda3 || 
        typeof lambda1 !== 'string' || 
        typeof lambda2 !== 'string' || 
        typeof lambda3 !== 'string') {
      return NextResponse.json({ valid: false, error: 'Invalid eigenvalue format' })
    }

    // Get current session
    const session = await getSession()
    if (!session || !session.enteredCrypt) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Unauthorized access - neural substrate breach required' 
      })
    }

    // Check if Floor 3 eigenvalue was already solved
    if (!session.unlockedFloors.includes(3)) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Eigenvalue computation incomplete - chaos access denied' 
      })
    }

    // Get correct eigenvalues from environment variables
    const correctLambda1 = process.env.CRYPT_FLOOR_3_LAMBDA1
    const correctLambda2 = process.env.CRYPT_FLOOR_3_LAMBDA2
    const correctLambda3 = process.env.CRYPT_FLOOR_3_LAMBDA3
    
    // Check if environment variables are loaded
    if (!correctLambda1 || !correctLambda2 || !correctLambda3) {
      console.error('Missing eigenvalue environment variables')
      return NextResponse.json({ 
        valid: false, 
        error: 'Server configuration error - eigenvalue validation unavailable' 
      }, { status: 500 })
    }
    
    // Debug logging
    console.log('=== CHAOS VALIDATION DEBUG ===')
    console.log('Submitted lambda1:', `"${lambda1.trim()}"`)
    console.log('Submitted lambda2:', `"${lambda2.trim()}"`)
    console.log('Submitted lambda3:', `"${lambda3.trim()}"`)
    console.log('Expected lambda1:', `"${correctLambda1}"`)
    console.log('Expected lambda2:', `"${correctLambda2}"`)
    console.log('Expected lambda3:', `"${correctLambda3}"`)
    console.log('Environment variables loaded:', {
      lambda1: !!correctLambda1,
      lambda2: !!correctLambda2,
      lambda3: !!correctLambda3
    })
    
    if (lambda1.trim() === correctLambda1 && 
        lambda2.trim() === correctLambda2 && 
        lambda3.trim() === correctLambda3) {
      return NextResponse.json({ 
        valid: true, 
        message: 'Linear stability analysis complete - neural chaos parameters confirmed' 
      })
    }
    
    return NextResponse.json({ 
      valid: false, 
      error: 'Eigenvalue analysis rejected - stability computation incorrect' 
    })
    
  } catch (error) {
    console.error('Chaos validation error:', error)
    return NextResponse.json({ 
      valid: false, 
      error: 'Neural chaos computation failed - differential collapse' 
    }, { status: 500 })
  }
}

// Prevent GET requests
export async function GET() {
  return NextResponse.json({ 
    error: 'Direct chaos protocol access forbidden - computational breach detected' 
  }, { status: 405 })
}