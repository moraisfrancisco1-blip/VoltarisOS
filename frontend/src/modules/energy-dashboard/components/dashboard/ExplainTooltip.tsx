import React from 'react';
import { HelpCircle } from 'lucide-react';
import { Tooltip } from '../ui/Tooltip';

interface ExplainTooltipProps {
  text: string;
}

export function ExplainTooltip({ text }: ExplainTooltipProps) {
  return (
    <Tooltip
      content={
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#f59e0b', marginTop: 6, flexShrink: 0 }} />
          <span>{text}</span>
        </div>
      }
    >
      <button
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          transition: 'background 0.2s',
        }}
        onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.12)'; }}
        onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
      >
        <HelpCircle size={12} color="#64748b" />
      </button>
    </Tooltip>
  );
}
