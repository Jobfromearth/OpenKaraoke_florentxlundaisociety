'use client'

interface LogoVinylProps {
  size?: number
  isPlaying?: boolean
}

export default function LogoVinyl({ size = 44, isPlaying = false }: LogoVinylProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* Breathing glow ring — pulses 0→0.85→0 in loop when playing */}
      <div
        style={{
          position: 'absolute',
          inset: -3,
          borderRadius: '50%',
          background: 'conic-gradient(from 0deg, #F0C050, #FF6B9D, #60A5FA, #4ADE80, #F0C050)',
          filter: 'blur(3px)',
          animationName: isPlaying ? 'glow-breathe' : 'none',
          animationDuration: '2s',
          animationTimingFunction: 'ease-in-out',
          animationIterationCount: 'infinite',
          opacity: isPlaying ? undefined : 0,
        }}
      />

      {/* Disc — spins when playing */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          overflow: 'hidden',
          position: 'relative',
          boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
          border: '2px solid rgba(255,255,255,0.18)',
          animationName: 'vinyl-spin',
          animationDuration: '4s',
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite',
          animationPlayState: isPlaying ? 'running' : 'paused',
        }}
      >
        <img
          src="/logo.png"
          alt="LinguaBeats"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />

        {/* Subtle vinyl gloss highlight */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background:
              'radial-gradient(ellipse at 28% 25%, rgba(255,255,255,0.22) 0%, transparent 55%)',
            pointerEvents: 'none',
          }}
        />
      </div>
    </div>
  )
}
