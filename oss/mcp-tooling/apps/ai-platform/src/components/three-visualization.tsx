'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

interface ParticleData {
  position: THREE.Vector3
  velocity: THREE.Vector3
  connections: number[]
}

export function ThreeVisualization() {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene>()
  const rendererRef = useRef<THREE.WebGLRenderer>()
  const cameraRef = useRef<THREE.PerspectiveCamera>()
  const frameRef = useRef<number>()
  const particlesRef = useRef<ParticleData[]>([])

  useEffect(() => {
    if (!mountRef.current) return

    // Scene setup
    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0x0a0a0a, 10, 50)
    sceneRef.current = scene

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    )
    camera.position.z = 30
    cameraRef.current = camera

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    rendererRef.current = renderer
    mountRef.current.appendChild(renderer.domElement)

    // Create particles
    const particles: ParticleData[] = []
    const particleCount = 150
    const particleGeometry = new THREE.BufferGeometry()
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)

    for (let i = 0; i < particleCount; i++) {
      const position = new THREE.Vector3(
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 40,
        (Math.random() - 0.5) * 20
      )

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.02
      )

      // Create connections between nearby particles
      const connections: number[] = []
      for (let j = 0; j < particleCount; j++) {
        if (i !== j && Math.random() < 0.02) {
          connections.push(j)
        }
      }

      particles.push({ position, velocity, connections })

      positions[i * 3] = position.x
      positions[i * 3 + 1] = position.y
      positions[i * 3 + 2] = position.z

      // Gradient colors from purple to pink
      const color = new THREE.Color()
      color.setHSL(0.75 + Math.random() * 0.15, 0.7, 0.6)
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }

    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    // Particle material
    const particleMaterial = new THREE.PointsMaterial({
      size: 0.8,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.8,
      sizeAttenuation: true
    })

    const particleSystem = new THREE.Points(particleGeometry, particleMaterial)
    scene.add(particleSystem)

    // Create connection lines
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x9333ea,
      transparent: true,
      opacity: 0.3,
      blending: THREE.AdditiveBlending
    })

    const connectionLines: THREE.Line[] = []
    particles.forEach((particle, i) => {
      particle.connections.forEach(targetIndex => {
        if (targetIndex > i) { // Avoid duplicate connections
          const targetParticle = particles[targetIndex]
          const lineGeometry = new THREE.BufferGeometry()
          const linePositions = new Float32Array([
            particle.position.x, particle.position.y, particle.position.z,
            targetParticle.position.x, targetParticle.position.y, targetParticle.position.z
          ])
          lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3))
          const line = new THREE.Line(lineGeometry, lineMaterial)
          scene.add(line)
          connectionLines.push(line)
        }
      })
    })

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5)
    scene.add(ambientLight)

    // Add point light
    const pointLight = new THREE.PointLight(0x9333ea, 1, 100)
    pointLight.position.set(10, 10, 10)
    scene.add(pointLight)

    particlesRef.current = particles

    // Mouse interaction
    let mouseX = 0
    let mouseY = 0

    const handleMouseMove = (event: MouseEvent) => {
      mouseX = (event.clientX / window.innerWidth) * 2 - 1
      mouseY = -(event.clientY / window.innerHeight) * 2 + 1
    }

    window.addEventListener('mousemove', handleMouseMove)

    // Handle resize
    const handleResize = () => {
      if (cameraRef.current && rendererRef.current) {
        cameraRef.current.aspect = window.innerWidth / window.innerHeight
        cameraRef.current.updateProjectionMatrix()
        rendererRef.current.setSize(window.innerWidth, window.innerHeight)
      }
    }

    window.addEventListener('resize', handleResize)

    // Animation loop
    const animate = () => {
      frameRef.current = requestAnimationFrame(animate)

      // Rotate particles
      particleSystem.rotation.y += 0.001

      // Update particle positions
      const positions = particleGeometry.attributes.position.array as Float32Array
      particles.forEach((particle, i) => {
        // Add some movement
        particle.position.add(particle.velocity)

        // Bounce off boundaries
        if (Math.abs(particle.position.x) > 20) particle.velocity.x *= -1
        if (Math.abs(particle.position.y) > 20) particle.velocity.y *= -1
        if (Math.abs(particle.position.z) > 10) particle.velocity.z *= -1

        positions[i * 3] = particle.position.x
        positions[i * 3 + 1] = particle.position.y
        positions[i * 3 + 2] = particle.position.z
      })

      particleGeometry.attributes.position.needsUpdate = true

      // Update connection lines
      connectionLines.forEach((line, index) => {
        const linePositions = line.geometry.attributes.position.array as Float32Array
        // Animate line opacity based on distance to center
        const distance = Math.sqrt(
          Math.pow((linePositions[0] + linePositions[3]) / 2, 2) +
          Math.pow((linePositions[1] + linePositions[4]) / 2, 2) +
          Math.pow((linePositions[2] + linePositions[5]) / 2, 2)
        )
        ;(line.material as THREE.LineBasicMaterial).opacity = Math.max(0.1, 0.5 - distance / 40)
      })

      // Camera parallax effect
      if (cameraRef.current) {
        cameraRef.current.position.x = mouseX * 5
        cameraRef.current.position.y = mouseY * 5
        cameraRef.current.lookAt(0, 0, 0)
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current)
      }
    }

    animate()

    // Cleanup
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('resize', handleResize)

      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
      }

      if (mountRef.current && rendererRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement)
      }

      rendererRef.current?.dispose()
      particleGeometry.dispose()
      particleMaterial.dispose()
      lineMaterial.dispose()
    }
  }, [])

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 w-full h-full"
      style={{ pointerEvents: 'none' }}
    />
  )
}