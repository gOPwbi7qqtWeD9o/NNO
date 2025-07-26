import { NextRequest, NextResponse } from 'next/server'
import { getSession, updateSession } from '@/lib/session'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accessKey } = body

    if (!accessKey || typeof accessKey !== 'string') {
      return NextResponse.json({ 
        valid: false, 
        error: 'Invalid access key format' 
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

    // Check if Floor 3 was completed (prerequisite)
    if (!session.unlockedFloors.includes(3)) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Prerequisites not met - complete Floor 3 first' 
      })
    }

    // Get the expected Floor 5 access key from environment
    const expectedKey = process.env.FLOOR5_ACCESS_KEY
    
    if (!expectedKey) {
      console.error('FLOOR5_ACCESS_KEY not set in environment')
      return NextResponse.json({ 
        valid: false, 
        error: 'Neural substrate configuration incomplete' 
      }, { status: 500 })
    }

    // Validate the access key
    if (accessKey.trim() === expectedKey) {
      // Update session to include Floor 4 completion (grants Floor 5 access)
      const updatedFloors = [...session.unlockedFloors]
      if (!updatedFloors.includes(4)) {
        updatedFloors.push(4)
      }
      
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

      console.log(`Floor 5 access granted via key for user: ${session.userId}`)

      return NextResponse.json({ 
        valid: true, 
        message: 'Neural substrate access granted - Floor 05 unlocked' 
      })
    }
    
    return NextResponse.json({ 
      valid: false, 
      error: 'Invalid neural substrate access key' 
    })
    
  } catch (error) {
    console.error('Floor 5 access validation error:', error)
    return NextResponse.json({ 
      valid: false, 
      error: 'Neural substrate access protocol failed' 
    }, { status: 500 })
  }
}

// Prevent GET requests
export async function GET() {
  return NextResponse.json({ 
    error: 'Direct neural access forbidden - key validation required' 
  }, { status: 405 })
}