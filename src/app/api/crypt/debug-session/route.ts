import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/session'

export async function GET() {
  try {
    const session = await getSession()
    
    return NextResponse.json({ 
      session: session,
      hasSession: !!session,
      enteredCrypt: session?.enteredCrypt || false,
      unlockedFloors: session?.unlockedFloors || [],
      debug: 'Session debug info'
    })
    
  } catch (error) {
    console.error('Session debug error:', error)
    return NextResponse.json({ 
      error: 'Debug failed',
      details: error
    }, { status: 500 })
  }
}