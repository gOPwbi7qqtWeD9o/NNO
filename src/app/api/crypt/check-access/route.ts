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
    
    // Check if user has access to this floor
    const access = hasFloorAccess(session, floor)
    
    return NextResponse.json({ 
      hasAccess: access,
      currentFloors: session?.unlockedFloors || [],
      message: access ? `Access granted to Floor ${floor}` : `Access denied to Floor ${floor}`
    })
    
  } catch (error) {
    console.error('Access check error:', error)
    return NextResponse.json({ 
      hasAccess: false, 
      error: 'Neural pathway validation failed' 
    }, { status: 500 })
  }
}