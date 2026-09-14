"use client"

import { Box } from "@mantine/core"
import Image from "next/image"

export function WalkingPiggy() {
  return (
    <Box
      pos="relative"
      w="100%"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 340,
        overflow: 'visible',
      }}
    >
      {/* Glow background blob */}
      <Box
        pos="absolute"
        style={{
          width: 320,
          height: 320,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(236,72,153,0.12) 0%, rgba(251,191,36,0.08) 50%, transparent 70%)',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      />

      {/* === KOIN JATUH === */}
      <Box
        pos="absolute"
        style={{
          top: 0,
          left: '50%',
          transform: 'translateX(-20px)',
          fontSize: 40,
          animation: 'coinDrop 2s ease-in-out infinite',
          filter: 'drop-shadow(0 8px 16px rgba(251,191,36,0.5))',
          zIndex: 3,
          pointerEvents: 'none',
        }}
      >
        💰
      </Box>

      {/* === BABI CELENGAN UTAMA === */}
      <Box
        pos="relative"
        style={{
          animation: 'pigFloat 3s ease-in-out infinite',
          zIndex: 2,
          transformOrigin: 'center bottom',
        }}
      >
        <Image
          src="/animasi-tampilan-harga.png"
          alt="Piggy Bank"
          width={380}
          height={380}
          style={{
            objectFit: 'contain',
            display: 'block',
            filter: 'drop-shadow(0 24px 48px rgba(236, 72, 153, 0.22))',
          }}
          priority
        />
      </Box>

      {/* === BAYANGAN BABI === */}
      <Box
        pos="absolute"
        style={{
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 280,
          height: 28,
          background: 'radial-gradient(ellipse, rgba(0,0,0,0.12) 0%, transparent 70%)',
          borderRadius: '50%',
          animation: 'shadowPulse 3s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* === SPARKLE BINTANG === */}
      {[
        { top: '12%',  left: '12%',  size: 28, delay: '0s',    color: '#FBBF24' },
        { top: '8%',   left: '72%',  size: 22, delay: '0.6s',  color: '#F59E0B' },
        { top: '55%',  left: '5%',   size: 18, delay: '1.1s',  color: '#FCD34D' },
        { top: '25%',  left: '82%',  size: 32, delay: '0.3s',  color: '#FBBF24' },
        { top: '70%',  left: '78%',  size: 20, delay: '1.5s',  color: '#F59E0B' },
        { top: '80%',  left: '18%',  size: 14, delay: '0.9s',  color: '#FCD34D' },
      ].map((s, i) => (
        <Box
          key={i}
          pos="absolute"
          style={{
            top: s.top,
            left: s.left,
            fontSize: s.size,
            color: s.color,
            animation: `sparkleFloat 2.5s ${s.delay} ease-in-out infinite`,
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 4,
            filter: `drop-shadow(0 2px 8px ${s.color}80)`,
          }}
        >
          ✦
        </Box>
      ))}

      {/* === UANG TERBANG === */}
      {[
        { top: '30%', left: '2%',  delay: '0.4s', symbol: '💵' },
        { top: '15%', left: '80%', delay: '1.2s', symbol: '🪙' },
        { top: '65%', left: '88%', delay: '0.8s', symbol: '💵' },
      ].map((m, i) => (
        <Box
          key={i}
          pos="absolute"
          style={{
            top: m.top,
            left: m.left,
            fontSize: 20,
            animation: `moneyFloat 3.5s ${m.delay} ease-in-out infinite`,
            pointerEvents: 'none',
            userSelect: 'none',
            zIndex: 3,
            opacity: 0.85,
          }}
        >
          {m.symbol}
        </Box>
      ))}

      {/* Keyframes */}
      <style>{`
        @keyframes pigFloat {
          0%   { transform: translateY(0px)   rotate(0deg)   scaleX(1); }
          20%  { transform: translateY(-18px) rotate(-1.5deg) scaleX(1); }
          40%  { transform: translateY(-28px) rotate(0deg)   scaleX(1); }
          60%  { transform: translateY(-18px) rotate(1.5deg)  scaleX(1); }
          80%  { transform: translateY(-8px)  rotate(0.5deg)  scaleX(1); }
          100% { transform: translateY(0px)   rotate(0deg)   scaleX(1); }
        }

        @keyframes shadowPulse {
          0%, 100% { transform: translateX(-50%) scaleX(1)    scaleY(1);    opacity: 0.7; }
          40%      { transform: translateX(-50%) scaleX(0.72) scaleY(0.7);  opacity: 0.35; }
        }

        @keyframes coinDrop {
          0%   { transform: translateX(-20px) translateY(-20px) rotate(-15deg); opacity: 0; }
          15%  { opacity: 1; }
          45%  { transform: translateX(-20px) translateY(10px)  rotate(10deg); }
          65%  { transform: translateX(-20px) translateY(0px)   rotate(-5deg); }
          80%  { transform: translateX(-20px) translateY(-8px)  rotate(3deg); opacity: 1; }
          100% { transform: translateX(-20px) translateY(-20px) rotate(-15deg); opacity: 0; }
        }

        @keyframes sparkleFloat {
          0%, 100% { transform: translateY(0px)   scale(0.85) rotate(0deg);   opacity: 0.6; }
          50%      { transform: translateY(-10px) scale(1.2)  rotate(20deg);  opacity: 1; }
        }

        @keyframes moneyFloat {
          0%, 100% { transform: translateY(0px)   rotate(-5deg); opacity: 0.7; }
          50%      { transform: translateY(-14px) rotate(8deg);  opacity: 1; }
        }
      `}</style>
    </Box>
  )
}
