import React from 'react'
import type { OverlayType } from '../styles/style-config'

const abs: React.CSSProperties = {
  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none',
}

export const OverlayFX: React.FC<{ type: OverlayType; accent: string }> = ({ type, accent }) => {
  switch (type) {
    case 'vignette':
      return <div style={{ ...abs, background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.6) 100%)' }} />
    case 'border':
      return <div style={{ ...abs, border: `3px solid ${accent}40`, boxSizing: 'border-box' }} />
    case 'corner-marks': {
      const mark: React.CSSProperties = { position: 'absolute', width: 40, height: 40, borderColor: accent + '60', borderStyle: 'solid' }
      return (
        <div style={abs}>
          <div style={{ ...mark, top: 20, left: 20, borderWidth: '3px 0 0 3px' }} />
          <div style={{ ...mark, top: 20, right: 20, borderWidth: '3px 3px 0 0' }} />
          <div style={{ ...mark, bottom: 20, left: 20, borderWidth: '0 0 3px 3px' }} />
          <div style={{ ...mark, bottom: 20, right: 20, borderWidth: '0 3px 3px 0' }} />
        </div>
      )
    }
    case 'glow-border':
      return <div style={{ ...abs, boxShadow: `inset 0 0 60px ${accent}20`, boxSizing: 'border-box' }} />
    default:
      return null
  }
}
