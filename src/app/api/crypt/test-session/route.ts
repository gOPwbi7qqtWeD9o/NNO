import { NextRequest, NextResponse } from 'next/server'
import { getSession, createSession } from '@/lib/session'
import { cookies } from 'next/headers'

export async function GET() {
  try {
    const session = await getSession()
    console.log('TEST - Current session:', session)
    
    return NextResponse.json({ 
      session,
      hasSession: !!session,
      unlockedFloors: session?.unlockedFloors || []
    })
  } catch (error) {
    console.error('TEST - Session get error:', error)
    return NextResponse.json({ error: 'Failed to get session' }, { status: 500 })
  }
}

export async function POST() {
  try {
    // Create a test session with floor 1 unlocked
    const userId = 'test-user-123'
    const sessionToken = await createSession(userId)
    
    // Manually create session with floor 1
    const { SignJWT } = await import('jose')
    const key = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || 'fallback-build-key-set-in-production-env')
    
    const testSession = {
      userId,
      enteredCrypt: true,
      unlockedFloors: [1],
      lastActivity: Date.now()
    }
    
    const testToken = await new SignJWT(testSession)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(key)
    
    const response = NextResponse.json({ 
      success: true,
      session: testSession,
      tokenLength: testToken.length
    })
    
    response.cookies.set('crypt-session', testToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'lax' : 'strict',
      maxAge: 86400,
      path: '/'
    })
    
    console.log('TEST - Created session with floor 1:', testSession)
    
    return response
  } catch (error) {
    console.error('TEST - Session create error:', error)
    return NextResponse.json({ error: 'Failed to create test session' }, { status: 500 })
  }
}