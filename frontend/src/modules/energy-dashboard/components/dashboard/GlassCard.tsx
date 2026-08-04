import React from 'react';
import { ExplainTooltip } from './ExplainTooltip';

interface GlassCardProps {
  title: string;
  children: React.ReactNode;
  explainText?: string;
  accentColor?: 'emerald' | 'amber' | 'violet' | 'blue' | 'rose';
  noPadding?: boolean;
  style?: React.CSSProperties;
}

const accentGradients: Record<string, string> = {
  emerald: 'rgba(16,185,129,0.08)',
  amber: 'rgba(245,158,11,0.08)',
  violet: 'rgba(139,92,246,0.08)',
  blue: 'rgba(59,130,246,0.08)',
  rose: 'rgba(244,63,94,0.08)',
};

export function GlassCard({ title, children, explainText, accentColor, noPadding, style }: GlassCardProps) {
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(17,24,39,0.8)',
        backdropFilter: 'blur(20px)',
        ...style,
      }}
    >
      {accentColor && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 96,
            background: `linear-gradient(to bottom, ${accentGradients[accentColor]}, transparent)`,
            pointerEvents: 'none' as const,
          }}
        />
      )}
      <div style={{ position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: noPadding ? '16px 20px 8px' : '16px 20px 12px',
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', margin: 0, letterSpacing: '-0.01em' }}>{title}</h3>
          {explainText && <ExplainTooltip text={explainText} />}
        </div>
        <div style={noPadding ? {} : { padding: '0 20px 20px' }}>{children}</div>
      </div>
    </div>
  );
}
