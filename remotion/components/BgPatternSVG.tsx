import React from 'react'
import type { BgPatternType } from '../styles/style-config'

const abs: React.CSSProperties = {
  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none',
}

export const BgPatternSVG: React.FC<{ type: BgPatternType; color: string; id: string }> = ({ type, color, id }) => {
  if (type === 'none') return null

  switch (type) {
    case 'grid':
      return (
        <svg style={abs}>
          <defs>
            <pattern id={`p-${id}`} width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke={color} strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#p-${id})`} />
        </svg>
      )
    case 'dots':
      return (
        <svg style={abs}>
          <defs>
            <pattern id={`p-${id}`} width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="12" cy="12" r="1.5" fill={color} />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#p-${id})`} />
        </svg>
      )
    case 'scanlines':
      return (
        <div style={{
          ...abs,
          background: `repeating-linear-gradient(0deg, transparent, transparent 3px, ${color} 3px, ${color} 4px)`,
        }} />
      )
    case 'diagonal':
      return (
        <svg style={abs}>
          <defs>
            <pattern id={`p-${id}`} width="20" height="20" patternUnits="userSpaceOnUse">
              <line x1="0" y1="20" x2="20" y2="0" stroke={color} strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#p-${id})`} />
        </svg>
      )
    case 'circles':
      return (
        <svg style={abs} viewBox="0 0 1080 1920" preserveAspectRatio="none">
          {[200, 400, 600, 800, 1000].map((r) => (
            <circle key={r} cx="540" cy="960" r={r} fill="none" stroke={color} strokeWidth="0.5" />
          ))}
        </svg>
      )
    default:
      return null
  }
}
