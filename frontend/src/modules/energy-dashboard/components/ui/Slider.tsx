import React, { useCallback, useRef } from 'react';

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function Slider({ value, onChange, min = 0, max = 100, step = 1 }: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pct = ((value - min) / (max - min)) * 100;

  const handleInteraction = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const raw = ((clientX - rect.left) / rect.width) * (max - min) + min;
      const stepped = Math.round(raw / step) * step;
      onChange(Math.max(min, Math.min(max, stepped)));
    },
    [min, max, step, onChange]
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    handleInteraction(e.clientX);
    const onMove = (ev: MouseEvent) => handleInteraction(ev.clientX);
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div
      ref={trackRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'relative',
        height: 20,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
      }}
    >
      {/* Track */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: 4,
          borderRadius: 2,
          background: 'rgba(255,255,255,0.06)',
        }}
      />
      {/* Fill */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          width: pct + '%',
          height: 4,
          borderRadius: 2,
          background: 'linear-gradient(90deg, #10b981, #34d399)',
        }}
      />
      {/* Thumb */}
      <div
        style={{
          position: 'absolute',
          left: pct + '%',
          transform: 'translateX(-50%)',
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#10b981',
          border: '2px solid #0a0f1a',
          boxShadow: '0 0 8px rgba(16,185,129,0.4)',
          transition: 'box-shadow 0.2s',
        }}
      />
    </div>
  );
}
