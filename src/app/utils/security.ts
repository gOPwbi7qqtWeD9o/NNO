import DOMPurify from 'dompurify'
import validator from 'validator'

// Initialize DOMPurify for different environments
let purify: typeof DOMPurify
if (typeof window !== 'undefined') {
  // Client-side
  purify = DOMPurify
} else {
  // Server-side
  const { JSDOM } = require('jsdom')
  const window = new JSDOM('').window
  purify = DOMPurify(window as any)
}

/**
 * Sanitize HTML content to prevent XSS attacks
 */
export function sanitizeHtml(html: string): string {
  return purify.sanitize(html, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  })
}

/**
 * Sanitize and validate username
 */
export function sanitizeUsername(username: string): string {
  if (!username || typeof username !== 'string') {
    throw new Error('Invalid username')
  }
  
  // Remove HTML tags and trim
  const clean = sanitizeHtml(username.trim())
  
  // Validate length
  if (clean.length < 1 || clean.length > 20) {
    throw new Error('Username must be 1-20 characters')
  }
  
  // Only allow alphanumeric, spaces, and basic punctuation
  if (!/^[a-zA-Z0-9\s\-_\.]+$/.test(clean)) {
    throw new Error('Username contains invalid characters')
  }
  
  return clean
}

/**
 * Sanitize and validate chat message
 */
export function sanitizeMessage(message: string): string {
  if (!message || typeof message !== 'string') {
    throw new Error('Invalid message')
  }
  
  // Remove HTML tags and trim
  const clean = sanitizeHtml(message.trim())
  
  // Validate length
  if (clean.length < 1) {
    throw new Error('Message cannot be empty')
  }
  
  if (clean.length > 1000) {
    throw new Error('Message too long (max 1000 characters)')
  }
  
  return clean
}

/**
 * Sanitize YouTube URL
 */
export function sanitizeYouTubeUrl(url: string): string {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL')
  }
  
  // Basic URL validation
  if (!validator.isURL(url)) {
    throw new Error('Invalid URL format')
  }
  
  // Check if it's a valid YouTube URL
  const youtubeRegex = /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//
  if (!youtubeRegex.test(url)) {
    throw new Error('Only YouTube URLs are allowed')
  }
  
  return url.trim()
}

/**
 * Rate limiting helper
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map()
  
  constructor(
    private maxRequests: number = 10,
    private windowMs: number = 60000 // 1 minute
  ) {}
  
  isAllowed(identifier: string): boolean {
    const now = Date.now()
    const userRequests = this.requests.get(identifier) || []
    
    // Remove old requests outside the window
    const validRequests = userRequests.filter(
      timestamp => now - timestamp < this.windowMs
    )
    
    if (validRequests.length >= this.maxRequests) {
      return false
    }
    
    validRequests.push(now)
    this.requests.set(identifier, validRequests)
    return true
  }
  
  reset(identifier: string): void {
    this.requests.delete(identifier)
  }
}
