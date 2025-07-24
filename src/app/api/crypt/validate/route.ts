import { NextRequest, NextResponse } from 'next/server'
import { getSession, updateSession } from '@/lib/session'
import { cookies } from 'next/headers'
import crypto from 'crypto'

// Hash the answers so they're not visible in source code
function hashAnswer(answer: string): string {
  return crypto.createHash('sha256').update(answer.toLowerCase().trim()).digest('hex')
}

// Get valid answer hashes from environment variables
const getValidAnswers = () => {
  const floor1Answer = process.env.CRYPT_FLOOR_1_ANSWER
  const floor2Answer = process.env.CRYPT_FLOOR_2_ANSWER
  
  if (!floor1Answer) {
    console.warn('CRYPT_FLOOR_1_ANSWER not set in environment variables')
  }
  
  return {
    1: floor1Answer ? hashAnswer(floor1Answer) : null,
    2: floor2Answer ? hashAnswer(floor2Answer) : null,
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
      // Update session with unlocked floor
      const updatedFloors = [...new Set([...session.unlockedFloors, unlockedFloor])]
      const newToken = await updateSession({ unlockedFloors: updatedFloors })
      
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
          sameSite: 'strict',
          maxAge: 86400 // 24 hours
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