"use client"

import { useEffect, useRef, useState } from "react"

interface Particle {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  symbol: string
  color: string
  size: number
  life: number // 0-1, decreasing
}

// Simbol-simbol bertema penelitian & akademik
const RESEARCH_SYMBOLS = [
  // Akademik & dokumen
  '📄', '📝', '📊', '🔬', '🧬', '🔭', '📚',
  // Matematika & data
  '∑', 'α', 'β', 'π', '∞', '∫', '√', '≡', 'Δ', 'λ', 'σ', 'μ',
  // Simbol ilmiah
  '✦', '◈', '⬡', '⊕', '⊗', '⊙', '◎',
  // Node/graph (tema knowledge map)
  '●', '◆', '▲', '⬟',
]

const COLORS = [
  '#3B82F6', // blue
  '#6366F1', // indigo
  '#8B5CF6', // violet
  '#0EA5E9', // sky
  '#06B6D4', // cyan
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EC4899', // pink
]

export function CursorBlink() {
  const [mounted, setMounted] = useState(false)
  const [particles, setParticles] = useState<Particle[]>([])
  const particleIdRef = useRef(0)
  const lastEmitRef = useRef(0)

  // Cursor ring state
  const ringRef = useRef<HTMLDivElement>(null)
  const dotRef = useRef<HTMLDivElement>(null)
  const mousePos = useRef({ x: -200, y: -200 })
  const ringPos = useRef({ x: -200, y: -200 })
  const rafRef = useRef<number | null>(null)
  const isHoveringClickable = useRef(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    // --- Smooth trailing ring animation ---
    const animateRing = () => {
      // Spring-like lag: ring chases mouse with lerp
      const lerpFactor = 0.12
      ringPos.current.x += (mousePos.current.x - ringPos.current.x) * lerpFactor
      ringPos.current.y += (mousePos.current.y - ringPos.current.y) * lerpFactor

      if (ringRef.current) {
        ringRef.current.style.transform = `translate(${ringPos.current.x - 20}px, ${ringPos.current.y - 20}px)`
      }
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${mousePos.current.x - 4}px, ${mousePos.current.y - 4}px)`
      }

      rafRef.current = requestAnimationFrame(animateRing)
    }
    rafRef.current = requestAnimationFrame(animateRing)

    // --- Mouse move: update position + emit particles ---
    const handleMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY }

      const now = Date.now()
      if (now - lastEmitRef.current < 60) return
      lastEmitRef.current = now

      const symbol = RESEARCH_SYMBOLS[Math.floor(Math.random() * RESEARCH_SYMBOLS.length)]
      const color = COLORS[Math.floor(Math.random() * COLORS.length)]
      const angle = Math.random() * Math.PI * 2
      const speed = 0.8 + Math.random() * 1.5
      const isEmoji = symbol.length > 1 || symbol.charCodeAt(0) > 0x2000

      const p: Particle = {
        id: particleIdRef.current++,
        x: e.clientX,
        y: e.clientY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.5, // bias upward
        symbol,
        color,
        size: isEmoji ? 14 + Math.random() * 8 : 12 + Math.random() * 10,
        life: 1,
      }

      setParticles(prev => [...prev.slice(-30), p]) // max 30 particles
      setTimeout(() => {
        setParticles(prev => prev.filter(pt => pt.id !== p.id))
      }, 1200)
    }

    // --- Detect hovering over clickable elements ---
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const clickable = target.closest('a, button, [role="button"], input, select, textarea, label')
      isHoveringClickable.current = !!clickable
      if (ringRef.current) {
        if (clickable) {
          ringRef.current.style.width = '48px'
          ringRef.current.style.height = '48px'
          ringRef.current.style.borderColor = '#3B82F6'
          ringRef.current.style.background = 'rgba(59, 130, 246, 0.08)'
        } else {
          ringRef.current.style.width = '40px'
          ringRef.current.style.height = '40px'
          ringRef.current.style.borderColor = 'rgba(99, 102, 241, 0.6)'
          ringRef.current.style.background = 'transparent'
        }
      }
    }

    const handleMouseLeave = () => {
      mousePos.current = { x: -200, y: -200 }
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseover', handleMouseOver)
    document.documentElement.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseover', handleMouseOver)
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [mounted])

  if (!mounted) return null

  return (
    <>
      {/* Trailing ring */}
      <div
        ref={ringRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 40,
          height: 40,
          borderRadius: '50%',
          border: '2px solid rgba(99, 102, 241, 0.6)',
          background: 'transparent',
          pointerEvents: 'none',
          zIndex: 99999,
          willChange: 'transform',
          transition: 'width 0.2s ease, height 0.2s ease, border-color 0.2s ease, background 0.2s ease',
          mixBlendMode: 'multiply',
        }}
      />

      {/* Precise dot at exact cursor */}
      <div
        ref={dotRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #6366F1, #3B82F6)',
          pointerEvents: 'none',
          zIndex: 100000,
          willChange: 'transform',
          boxShadow: '0 0 6px rgba(99, 102, 241, 0.8), 0 0 12px rgba(59, 130, 246, 0.4)',
        }}
      />

      {/* Research-themed particles */}
      {particles.map(p => (
        <ResearchParticle key={p.id} particle={p} />
      ))}
    </>
  )
}

function ResearchParticle({ particle }: { particle: Particle }) {
  const elRef = useRef<HTMLDivElement>(null)
  const startTime = useRef(Date.now())
  const posRef = useRef({ x: particle.x, y: particle.y, vx: particle.vx, vy: particle.vy })
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const animate = () => {
      const elapsed = (Date.now() - startTime.current) / 1200 // 0 to 1
      if (elapsed >= 1) {
        if (elRef.current) elRef.current.style.opacity = '0'
        return
      }

      // Physics
      posRef.current.vy += 0.04 // gravity
      posRef.current.x += posRef.current.vx
      posRef.current.y += posRef.current.vy

      const opacity = Math.pow(1 - elapsed, 1.5)
      const scale = 0.4 + (1 - elapsed) * 0.8

      if (elRef.current) {
        elRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px) scale(${scale}) rotate(${elapsed * 360}deg)`
        elRef.current.style.opacity = String(opacity)
      }

      rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <div
      ref={elRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 99998,
        fontSize: particle.size,
        color: particle.color,
        textShadow: `0 0 8px ${particle.color}80`,
        willChange: 'transform, opacity',
        userSelect: 'none',
        lineHeight: 1,
        transform: `translate(${particle.x}px, ${particle.y}px)`,
      }}
    >
      {particle.symbol}
    </div>
  )
}
