import React, { useState, useRef } from 'react';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: 'top' | 'bottom';
}

export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      style={{ position: 'relative', display: 'inline-flex' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div
          style={{
            position: 'absolute',
            [side === 'top' ? 'bottom' : 'top']: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 50,
            maxWidth: 260,
            padding: '8px 12px',
            background: '#1a2332',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12,
            color: '#e2e8f0',
            fontSize: 11,
            lineHeight: 1.5,
            whiteSpace: 'normal' as const,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            pointerEvents: 'none' as const,
          }}
        >
          {content}
        </div>
      )}
    </div>
  );
}
