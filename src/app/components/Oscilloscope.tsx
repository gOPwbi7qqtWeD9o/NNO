import React, { useEffect, useRef } from 'react'

interface OscilloscopeProps {
  typingData: { username: string; content: string }[]
  currentTyping: string
  cryptLevel?: number
}

interface SpherePoint {
  x: number
  y: number
  z: number
  baseRadius: number
  currentRadius: number
  angle: number
  phi: number
  frequency: number
  amplitude: number
}

const Oscilloscope: React.FC<OscilloscopeProps> = ({ typingData, currentTyping, cryptLevel = 0 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const spherePointsRef = useRef<SpherePoint[]>([])
  const timeRef = useRef(0)
  const rotationRef = useRef({ x: 0, y: 0, z: 0 })
  const lastTypingTimeRef = useRef(0)
  const typingVelocityRef = useRef({ x: 0, y: 0, z: 0 })

  // Get color and instability based on crypt level
  const getCryptLevelProperties = (level: number) => {
    switch (level) {
      case 0: // Normal chat
        return {
          color: 'rgba(255, 180, 100, ',
          instabilityMultiplier: 1,
          chaosLevel: 0
        }
      case 1: // Floor 1
        return {
          color: 'rgba(255, 50, 50, ',
          instabilityMultiplier: 1.8,
          chaosLevel: 0.3
        }
      case 2: // Floor 2
        return {
          color: 'rgba(150, 50, 255, ',
          instabilityMultiplier: 2.5,
          chaosLevel: 0.6
        }
      case 3: // Floor 3
        return {
          color: 'rgba(50, 255, 50, ',
          instabilityMultiplier: 3.2,
          chaosLevel: 0.9
        }
      default:
        return {
          color: 'rgba(255, 255, 255, ',
          instabilityMultiplier: 4,
          chaosLevel: 1
        }
    }
  }

  // Map characters to distortion properties
  const getCharacterProperties = (char: string) => {
    const code = char.toLowerCase().charCodeAt(0)
    const { instabilityMultiplier } = getCryptLevelProperties(cryptLevel)
    const frequency = ((code - 97) % 26) * 0.25 + 0.8  // More dramatic frequency range
    const amplitude = (((code - 97) % 15) * 2.5 + 8) * instabilityMultiplier     // Multiply by crypt level
    return { frequency, amplitude }
  }

  // Initialize sphere points
  useEffect(() => {
    const points: SpherePoint[] = []
    const density = 40 // Even more points for ultra-detailed visualization
    const rings = 30   // More rings for smoother surface
    const baseRadius = 120 // Much larger radius - true centerpiece

    for (let ring = 0; ring < rings; ring++) {
      const phi = (ring / (rings - 1)) * Math.PI
      const y = Math.cos(phi) * baseRadius
      const ringRadius = Math.sin(phi) * baseRadius

      for (let point = 0; point < density; point++) {
        const angle = (point / density) * Math.PI * 2
        const x = Math.cos(angle) * ringRadius
        const z = Math.sin(angle) * ringRadius

        points.push({
          x,
          y,
          z,
          baseRadius: Math.sqrt(x * x + y * y + z * z),
          currentRadius: Math.sqrt(x * x + y * y + z * z),
          angle,
          phi,
          frequency: 1,
          amplitude: 0
        })
      }
    }
    spherePointsRef.current = points
  }, [])

  // Update sphere distortion based on typing
  useEffect(() => {
    const allTyping = [...typingData, { username: 'current', content: currentTyping }]
    const combinedText = allTyping.map(t => t.content).join('')
    
    if (combinedText && spherePointsRef.current.length > 0) {
      const lastChar = combinedText[combinedText.length - 1]
      if (lastChar) {
        const { frequency, amplitude } = getCharacterProperties(lastChar)
        
        // Update rotation velocity based on character input
        const now = Date.now()
        if (now - lastTypingTimeRef.current > 50) {
          const charCode = lastChar.charCodeAt(0)
          typingVelocityRef.current.x += (charCode % 5) * 0.002 - 0.004
          typingVelocityRef.current.y += ((charCode + 17) % 7) * 0.0015 - 0.005
          typingVelocityRef.current.z += ((charCode + 37) % 3) * 0.003 - 0.003
          lastTypingTimeRef.current = now
        }
        
        // Apply distortion to more points for dramatic effect
        const affectedPoints = Math.floor(spherePointsRef.current.length * 0.6) // Affect 60% of points
        for (let i = 0; i < affectedPoints; i++) {
          const randomIndex = Math.floor(Math.random() * spherePointsRef.current.length)
          const point = spherePointsRef.current[randomIndex]
          point.frequency = frequency
          point.amplitude = amplitude
        }
      }
    }
  }, [typingData, currentTyping])

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const centerX = canvas.width / 2
    const centerY = canvas.height / 2

    const animate = () => {
      const { chaosLevel } = getCryptLevelProperties(cryptLevel)
      timeRef.current += 0.02 + (chaosLevel * 0.01) // Faster time progression at higher levels
      
      // Update rotation based on typing velocity and natural drift + chaos
      const chaosX = chaosLevel * (Math.random() - 0.5) * 0.01
      const chaosY = chaosLevel * (Math.random() - 0.5) * 0.01
      const chaosZ = chaosLevel * (Math.random() - 0.5) * 0.01
      
      rotationRef.current.x += typingVelocityRef.current.x + 0.003 + chaosX
      rotationRef.current.y += typingVelocityRef.current.y + 0.005 + chaosY
      rotationRef.current.z += typingVelocityRef.current.z + 0.002 + chaosZ
      
      // Apply damping to typing velocity for natural feel
      typingVelocityRef.current.x *= 0.95
      typingVelocityRef.current.y *= 0.95
      typingVelocityRef.current.z *= 0.95
      
      // Clear canvas completely - no fade effect
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Prepare for drawing
      const projectedPoints: Array<{x: number, y: number, z: number, intensity: number}> = []
      
      spherePointsRef.current.forEach(point => {
        // Apply multiple wave distortions for complex geometry
        const distortion1 = Math.sin(timeRef.current * point.frequency + point.angle) * point.amplitude
        const distortion2 = Math.cos(timeRef.current * point.frequency * 1.4 + point.phi) * (point.amplitude * 0.7)
        const distortion3 = Math.sin(timeRef.current * point.frequency * 0.6 + point.angle * 2) * (point.amplitude * 0.5)
        const combinedDistortion = distortion1 + distortion2 + distortion3
        
        point.currentRadius = point.baseRadius + combinedDistortion
        
        // Calculate 3D position with distortion
        const x = Math.cos(point.angle) * Math.sin(point.phi) * point.currentRadius
        const y = Math.cos(point.phi) * point.currentRadius
        const z = Math.sin(point.angle) * Math.sin(point.phi) * point.currentRadius
        
        // Apply 3D rotation (now including Z-axis for more dynamic movement)
        const rotX = rotationRef.current.x
        const rotY = rotationRef.current.y
        const rotZ = rotationRef.current.z
        
        // X rotation
        const y1 = y * Math.cos(rotX) - z * Math.sin(rotX)
        const z1 = y * Math.sin(rotX) + z * Math.cos(rotX)
        
        // Y rotation  
        const x2 = x * Math.cos(rotY) - z1 * Math.sin(rotY)
        const z2 = x * Math.sin(rotY) + z1 * Math.cos(rotY)
        
        // Z rotation
        const x3 = x2 * Math.cos(rotZ) - y1 * Math.sin(rotZ)
        const y3 = x2 * Math.sin(rotZ) + y1 * Math.cos(rotZ)
        
        // Project to 2D using final rotated coordinates
        const distance = 200
        const projX = centerX + (x3 * distance) / (distance + z2)
        const projY = centerY + (y3 * distance) / (distance + z2)
        
        // Calculate intensity based on z-depth
        const intensity = Math.max(0, (z2 + 100) / 200)
        
        projectedPoints.push({ x: projX, y: projY, z: z2, intensity })
        
        // Decay amplitude more slowly for longer-lasting effects
        if (point.amplitude > 0) {
          point.amplitude *= 0.96 // Slower decay
        }
      })
      
      // Sort by depth and draw with crisp rendering
      projectedPoints.sort((a, b) => a.z - b.z)
      
      // TRULY pixel-perfect setup
      const dpr = window.devicePixelRatio || 1
      canvas.width = 600 * dpr
      canvas.height = 600 * dpr
      canvas.style.width = '600px'
      canvas.style.height = '600px'
      ctx.scale(dpr, dpr)
      
      ctx.imageSmoothingEnabled = false
      ctx.globalAlpha = 1.0
      
      // Clear canvas completely
      ctx.clearRect(0, 0, 600, 600)
      ctx.fillStyle = 'transparent'
      ctx.fillRect(0, 0, 600, 600)
      
      projectedPoints.forEach(point => {
        const { color, chaosLevel } = getCryptLevelProperties(cryptLevel)
        const baseAlpha = Math.min(Math.max(point.intensity * 2.0, 0.7), 1.0)
        const chaosAlpha = chaosLevel > 0 ? baseAlpha + (Math.random() - 0.5) * chaosLevel * 0.3 : baseAlpha
        const alpha = Math.min(Math.max(chaosAlpha, 0.3), 1.0)
        
        // Use exact integer coordinates with slight chaos offset at higher levels
        const chaosOffsetX = chaosLevel * (Math.random() - 0.5) * 2
        const chaosOffsetY = chaosLevel * (Math.random() - 0.5) * 2
        const x = Math.round(point.x + chaosOffsetX)
        const y = Math.round(point.y + chaosOffsetY)
        
        ctx.fillStyle = `${color}${alpha})`
        
        // Bigger points at higher crypt levels
        const pointSize = 4 + Math.floor(chaosLevel * 2)
        ctx.fillRect(x-1, y-1, pointSize, pointSize)
      })
      
      // Remove central glow entirely for now to test
      
      animationRef.current = requestAnimationFrame(animate)
    }
    
    animate()
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [currentTyping])

  return (
    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-10">
      <div className="transition-opacity duration-700">
        <canvas
          ref={canvasRef}
          width={600}
          height={600}
          style={{ 
            background: 'none',
            imageRendering: 'pixelated',
            filter: 'none',
            transform: 'none',
            border: 'none',
            outline: 'none'
          }}
        />
      </div>
    </div>
  )
}

export default Oscilloscope
