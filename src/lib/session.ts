import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const key = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'fallback-build-key-set-in-production-env'
)

export interface CryptSession {
  userId: string
  enteredCrypt: boolean
  unlockedFloors: number[]
  lastActivity: number
  [key: string]: any // Index signature for JWT compatibility
}

export async function createSession(userId: string): Promise<string> {
  const session: CryptSession = {
    userId,
    enteredCrypt: true,
    unlockedFloors: [],
    lastActivity: Date.now()
  }

  const jwt = await new SignJWT(session)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(key)

  return jwt
}

export async function getSession(): Promise<CryptSession | null> {
  try {
    const cookieStore = cookies()
    const token = cookieStore.get('crypt-session')?.value

    if (!token) return null

    const { payload } = await jwtVerify(token, key)
    return payload as CryptSession
  } catch (error) {
    return null
  }
}

export async function updateSession(updates: Partial<CryptSession>): Promise<string | null> {
  try {
    const currentSession = await getSession()
    if (!currentSession) return null

    const updatedSession: CryptSession = {
      ...currentSession,
      ...updates,
      lastActivity: Date.now()
    }

    const jwt = await new SignJWT(updatedSession)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(key)

    return jwt
  } catch (error) {
    return null
  }
}

export function hasFloorAccess(session: CryptSession | null, floor: number): boolean {
  if (!session || !session.enteredCrypt) return false
  return session.unlockedFloors.includes(floor)
}