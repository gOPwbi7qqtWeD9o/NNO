import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const hasSecret = !!process.env.NEXTAUTH_SECRET
    const secretLength = process.env.NEXTAUTH_SECRET?.length || 0
    
    return NextResponse.json({ 
      hasSecret,
      secretLength,
      nodeEnv: process.env.NODE_ENV,
      timestamp: Date.now()
    })
    
  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json({ 
      error: 'Debug failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}