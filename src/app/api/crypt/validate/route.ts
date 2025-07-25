import { NextRequest, NextResponse } from 'next/server'
import { getSession, updateSession, CryptSession } from '@/lib/session'
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { SignJWT } from 'jose'

// Hash the answers so they're not visible in source code
function hashAnswer(answer: string): string {
  return crypto.createHash('sha256').update(answer.toLowerCase().trim()).digest('hex')
}

// Get valid answer hashes from environment variables
const getValidAnswers = () => {
  const floor1Answer = process.env.CRYPT_FLOOR_1_ANSWER
  const floor2Answer = process.env.CRYPT_FLOOR_2_ANSWER
  const floor3Answer = process.env.CRYPT_FLOOR_3_ANSWER
  
  if (!floor1Answer && process.env.NODE_ENV === 'production') {
    console.warn('CRYPT_FLOOR_1_ANSWER not set in environment variables')
  }
  
  return {
    1: floor1Answer ? hashAnswer(floor1Answer) : null,
    2: floor2Answer ? hashAnswer(floor2Answer) : null,
    3: floor3Answer ? hashAnswer(floor3Answer) : null,
  }
}

export async function POST(request: NextRequest) {
  try {
    const { hash } = await request.json()
    
    if (!hash || typeof hash !== 'string') {
      return NextResponse.json({ valid: false, error: 'Invalid neural key format' })
    }

    // Get current session
    const session = await getSession()
    if (!session || !session.enteredCrypt) {
      return NextResponse.json({ 
        valid: false, 
        error: 'Unauthorized access - must enter through crypt entrance' 
      })
    }

    // Hash the submitted answer
    const submittedHash = hashAnswer(hash)
    const validAnswers = getValidAnswers()
    
    
    // Check which floor this answer unlocks
    let unlockedFloor = 0
    for (const [floor, validHash] of Object.entries(validAnswers)) {
      if (validHash && submittedHash === validHash) {
        unlockedFloor = parseInt(floor)
        break
      }
    }
    
    if (unlockedFloor > 0) {
      // Create new session with unlocked floor
      const currentFloors = Array.isArray(session.unlockedFloors) ? session.unlockedFloors : []
      const floorSet = new Set(currentFloors)
      floorSet.add(unlockedFloor)
      const updatedFloors = Array.from(floorSet)
      
      // Create completely new session instead of updating
      const newSession: CryptSession = {
        userId: session.userId,
        enteredCrypt: true,
        unlockedFloors: updatedFloors,
        lastActivity: Date.now()
      }
      
      const newToken = await new SignJWT(newSession)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'fallback-build-key-set-in-production-env'))
      
      if (newToken) {
        const response = NextResponse.json({ 
          valid: true, 
          floor: unlockedFloor,
          message: `Neural pathway to Floor ${unlockedFloor} established` 
        })
        
        // Set the updated session cookie
        response.cookies.set('crypt-session', newToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'strict',
          maxAge: 86400, // 24 hours
          path: '/'
        })
        
        return response
      }
    }
    
    return NextResponse.json({ 
      valid: false, 
      error: 'Neural key not recognized by crypt systems' 
    })
    
  } catch (error) {
    console.error('Crypt validation error:', error)
    return NextResponse.json({ 
      valid: false, 
      error: 'Neural pathway error during validation' 
    }, { status: 500 })
  }
}

// Prevent GET requests
export async function GET() {
  return NextResponse.json({ 
    error: 'Direct access to crypt validation protocols is forbidden' 
  }, { status: 405 })
}