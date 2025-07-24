import { NextRequest, NextResponse } from 'next/server'
import { createSession } from '@/lib/session'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    // Generate a unique user ID for this session
    const userId = crypto.randomBytes(16).toString('hex')
    
    // Create new session
    const sessionToken = await createSession(userId)
    
    const response = NextResponse.json({ 
      success: true,
      message: 'Crypt entrance accessed - neural pathways initialized' 
    })
    
    // Set session cookie
    response.cookies.set('crypt-session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 86400 // 24 hours
    })
    
    return response
    
  } catch (error) {
    console.error('Session creation error:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to establish neural connection' 
    }, { status: 500 })
  }
}