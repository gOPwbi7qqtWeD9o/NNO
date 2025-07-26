import { NextRequest, NextResponse } from 'next/server'
import { getSession, updateSession } from '@/lib/session'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { passkey } = await request.json()
    
    if (!passkey || typeof passkey !== 'string') {
      return NextResponse.json({ 
        valid: false, 
        error: 'Invalid neural code format' 
      })
    }

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
        message: 'Floor 5 already completed' 
      })
    }

    // Get the correct passkey from environment variables
    const correctPasskey = process.env.DH_CORRECT_PASSKEY
    
    if (!correctPasskey) {
      console.error('DH_CORRECT_PASSKEY not set in environment variables')
      return NextResponse.json({ 
        valid: false, 
        error: 'Mathematical substrate validation unavailable' 
      })
    }

    // Validate the passkey
    if (passkey.trim() === correctPasskey.trim()) {
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

      console.log(`Floor 5 DH puzzle completed for user: ${session.userId}`)

      return NextResponse.json({ 
        valid: true, 
        message: 'Mathematical substrate barriers dissolved' 
      })
    }

    // Generate progressive hints based on attempt patterns
    const hints = [
      'The encoded fragment resists surface analysis.',
      'Computational persistence may reveal hidden structures.',
      'The substrate salt guides the dissolution process.',
      'Mathematical relationships exist between all parameters.',
      'Deep computational methods unlock neural fragments.'
    ]
    
    // Return a random hint to avoid giving away the solution
    const randomHint = hints[Math.floor(Math.random() * hints.length)]
    
    return NextResponse.json({ 
      valid: false, 
      hint: randomHint
    })
    
  } catch (error) {
    console.error('DH validation error:', error)
    return NextResponse.json({ 
      valid: false, 
      error: 'Neural substrate validation failed' 
    }, { status: 500 })
  }
}

// Prevent other HTTP methods
export async function GET() {
  return NextResponse.json({ 
    error: 'Neural code submission required via POST' 
  }, { status: 405 })
}