import { NextRequest, NextResponse } from 'next/server'
import { getSession, hasFloorAccess } from '@/lib/session'

export async function POST(request: NextRequest) {
  try {
    const { floor } = await request.json()
    
    if (!floor || typeof floor !== 'number') {
      return NextResponse.json({ 
        hasAccess: false, 
        error: 'Invalid floor specified' 
      })
    }

    // Get current session
    const session = await getSession()
    
    // Debug logging
    console.log('ACCESS CHECK - Floor:', floor)
    console.log('ACCESS CHECK - Session:', session)
    console.log('ACCESS CHECK - Unlocked floors:', session?.unlockedFloors)
    
    // Check if user has completed the prerequisite floor to access the requested floor
    const access = hasFloorAccess(session, floor)
    
    console.log('ACCESS CHECK - Access result:', access)
    
    return NextResponse.json({ 
      hasAccess: access,
      currentFloors: session?.unlockedFloors || [],
      message: access ? `Prerequisites met for Floor ${floor + 1}` : `Prerequisites not met - complete Floor ${floor} first`
    })
    
  } catch (error) {
    console.error('Access check error:', error)
    return NextResponse.json({ 
      hasAccess: false, 
      error: 'Neural pathway validation failed' 
    }, { status: 500 })
  }
}