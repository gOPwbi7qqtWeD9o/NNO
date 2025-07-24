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
  if (!html || typeof html !== 'string') return ''
  
  // Use DOMPurify to remove dangerous HTML but preserve plain text
  const sanitized = purify.sanitize(html, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: []
  })
  
  // Decode HTML entities back to normal characters for display
  // This is safe because we've already removed all HTML tags
  return sanitized
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&amp;/g, '&') // This should be last to avoid double-decoding
}

/**
 * Sanitize and validate username
 */
export function sanitizeUsername(username: string): string {
  if (!username || typeof username !== 'string') {
    throw new Error('Invalid username')
  }
  
  // Check for dangerous patterns first
  if (/<script|javascript:|on\w+\s*=/gi.test(username)) {
    throw new Error('Username contains invalid characters')
  }
  
  // Remove HTML tags and trim, then decode entities
  const clean = sanitizeHtml(username.trim())
  
  // Validate length
  if (clean.length < 1 || clean.length > 20) {
    throw new Error('Username must be 1-20 characters')
  }
  
  // Only allow alphanumeric, spaces, and basic punctuation (including < and >)
  if (!/^[a-zA-Z0-9\s\-_\.<>]+$/.test(clean)) {
    throw new Error('Username contains invalid characters')
  }
  
  // Enhanced system username protection
  const lowerClean = clean.toLowerCase()
  const bannedNames = [
    'system', 'admin', 'administrator', 'root', 'mod', 'moderator',
    'bot', 'server', 'null', 'undefined', 'anonymous', 'guest',
    'sys', 'sysadmin', 'support', 'help', 'service'
  ]
  
  if (bannedNames.includes(lowerClean)) {
    throw new Error('Username is reserved')
  }
  
  // Prevent variations like "System", "SYSTEM", "5ystem", etc.
  if (lowerClean.includes('system') || lowerClean.includes('admin')) {
    throw new Error('Username contains restricted terms')
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
  
  // First, check for obviously malicious patterns before processing
  const dangerousPatterns = [
    /<script[\s\S]*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe/gi,
    /\beval\s*\(/gi,
    /data:text\/html/gi
  ]
  
  if (dangerousPatterns.some(pattern => pattern.test(message))) {
    throw new Error('Message contains potentially dangerous content')
  }
  
  // Remove HTML tags and trim, then decode entities for normal display
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
