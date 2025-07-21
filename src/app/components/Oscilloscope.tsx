import React, { useEffect, useRef } from 'react'

interface OscilloscopeProps {
  typingData: { username: string; content: string }[]
  currentTyping: string
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

const Oscilloscope: React.FC<OscilloscopeProps> = ({ typingData, currentTyping }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const spherePointsRef = useRef<SpherePoint[]>([])
  const timeRef = useRef(0)
  const rotationRef = useRef({ x: 0, y: 0, z: 0 })
  const lastTypingTimeRef = useRef(0)
  const typingVelocityRef = useRef({ x: 0, y: 0, z: 0 })

  // Map characters to distortion properties
  const getCharacterProperties = (char: string) => {
    const code = char.toLowerCase().charCodeAt(0)
    const frequency = ((code - 97) % 26) * 0.25 + 0.8  // More dramatic frequency range
    const amplitude = ((code - 97) % 15) * 2.5 + 8     // Much higher amplitude for dramatic distortions
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
      timeRef.current += 0.02
      
      // Update rotation based on typing velocity and natural drift
      rotationRef.current.x += typingVelocityRef.current.x + 0.003
      rotationRef.current.y += typingVelocityRef.current.y + 0.005
      rotationRef.current.z += typingVelocityRef.current.z + 0.002
      
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
        const alpha = Math.min(Math.max(point.intensity * 2.0, 0.7), 1.0)
        
        // Use exact integer coordinates
        const x = Math.round(point.x)
        const y = Math.round(point.y)
        
        ctx.fillStyle = `rgba(255, 180, 100, ${alpha})`
        
        // Much bigger, more visible points
        ctx.fillRect(x-1, y-1, 4, 4)
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
