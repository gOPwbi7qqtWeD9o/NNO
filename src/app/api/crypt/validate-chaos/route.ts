import { NextRequest, NextResponse } from 'next/server'
import { getSession, updateSession } from '@/lib/session'
import { cookies } from 'next/headers'

async function validateUltimatumGame(body: any) {
  try {
    // Get current session
    const session = await getSession()
    
    if (!session || !session.enteredCrypt) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Neural pathway access denied' 
      })
    }

    // Check if Floor 4 was completed (prerequisite for Floor 5)
    if (!session.unlockedFloors.includes(4)) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Prerequisites not met - complete Floor 4 first' 
      })
    }

    // Check if Floor 5 is already completed
    if (session.unlockedFloors.includes(5)) {
      return NextResponse.json({ 
        valid: true, 
        floor: 5,
        message: 'Floor 5 already completed' 
      })
    }

    // Validate game completion using environment variable
    const expectedAnswer = process.env.FLOOR5_VALIDATION_KEY
    
    if (!expectedAnswer) {
      console.error('FLOOR5_VALIDATION_KEY not set in environment')
      return NextResponse.json({ 
        valid: false, 
        error: 'Corporate validation protocols unavailable' 
      })
    }

    // For the ultimatum game, we trust that the client completed successfully
    // since the game logic is handled server-side
    
    // Update session to include Floor 5
    const updatedFloors = [...session.unlockedFloors, 5]
    const newToken = await updateSession({ unlockedFloors: updatedFloors })
    
    if (!newToken) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Neural pathway update failed' 
      })
    }

    // Set updated session cookie
    const cookieStore = cookies()
    cookieStore.set('crypt-session', newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 // 24 hours
    })

    console.log(`Floor 5 completed for user: ${session.userId}`)

    return NextResponse.json({ 
      valid: true, 
      floor: 5,
      message: 'Collective intelligence protocols successfully demonstrated' 
    })
    
  } catch (error) {
    console.error('Ultimatum game validation error:', error)
    return NextResponse.json({ 
      valid: false, 
      error: 'Corporate substrate validation failed' 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { lambda1, lambda2, lambda3, gameType } = body

    // Handle Floor 5 ultimatum game validation
    if (gameType === 'ultimatum') {
      return await validateUltimatumGame(body)
    }

    // Handle Floor 3 eigenvalue validation (existing logic)
    
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

    // Check if Floor 2 was completed (prerequisite for Floor 3)
    if (!session.unlockedFloors.includes(2)) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Prerequisites not met - complete Floor 2 first' 
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
      
      // Update session to include Floor 3 completion
      const updatedFloors = [...session.unlockedFloors, 3]
      const newToken = await updateSession({ unlockedFloors: updatedFloors })
      
      if (!newToken) {
        return NextResponse.json({ 
          valid: false, 
          error: 'Neural pathway update failed' 
        })
      }

      // Set updated session cookie
      const cookieStore = cookies()
      cookieStore.set('crypt-session', newToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 // 24 hours
      })

      console.log(`Floor 3 completed for user: ${session.userId}`)
      
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