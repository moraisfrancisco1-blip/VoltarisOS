/// <reference types="react" />
import React, { useState } from 'react';
import { Activity, Globe } from 'lucide-react';
import { useDashboardStore } from '../../lib/store';
import { t } from '../../lib/i18n';

const BILLING_URL = 'https://se303bch6c5bf4hrjpjkj-preview-4200.runable.site';

export function Header() {
  const { lang, setLang, mode, setMode } = useDashboardStore();
  const [showPlanModal, setShowPlanModal] = useState(false);

  const modeBtn = (m: 'operator' | 'investor', label: string, activeColor: string) => {
    const isActive = mode === m;
    return (
      <button
        onClick={() => setMode(m)}
        style={{
          padding: '6px 16px',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 600,
          border: 'none',
          cursor: 'pointer',
          transition: 'all 0.3s',
          background: isActive ? activeColor : 'transparent',
          color: isActive ? (m === 'operator' ? '#34d399' : '#a78bfa') : '#94a3b8',
        }}
      >
        {label}
      </button>
    );
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'linear-gradient(135deg, #34d399, #10b981)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(16,185,129,0.2)',
            }}>
              <Activity size={20} color="#fff" />
            </div>
            <div style={{
              position: 'absolute', top: -2, right: -2,
              width: 12, height: 12, background: '#34d399',
              borderRadius: '50%', border: '2px solid #0a0f1a',
              animation: 'pulse 2s infinite',
            }} />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0, letterSpacing: '-0.02em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              VoltarisOS
            </h1>
            <p style={{ fontSize: 11, color: '#64748b', margin: '-2px 0 0 0' }}>Intelligent Energy Management</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => setShowPlanModal(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(52,211,153,0.15), rgba(16,185,129,0.15))',
              border: '1px solid rgba(52,211,153,0.3)',
              fontSize: 12, color: '#34d399', cursor: 'pointer', fontWeight: 600, transition: 'all 0.2s',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
            Change Plan
          </button>

          <a
            href={`${BILLING_URL}/sign-in`}
            target="_blank" rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
              border: '1px solid rgba(99,102,241,0.35)',
              fontSize: 12, color: '#a78bfa', cursor: 'pointer', fontWeight: 600,
              textDecoration: 'none', transition: 'all 0.2s',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/>
            </svg>
            Billing
          </a>

          <div style={{
            display: 'flex', alignItems: 'center',
            background: 'rgba(255,255,255,0.04)', borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.06)', padding: 2,
          }}>
            {modeBtn('operator', t('mode.operator', lang), 'rgba(16,185,129,0.15)')}
            {modeBtn('investor', t('mode.investor', lang), 'rgba(139,92,246,0.15)')}
          </div>

          <button
            onClick={() => setLang(lang === 'pt' ? 'en' : 'pt')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 12,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
              fontSize: 12, color: '#94a3b8', cursor: 'pointer', fontWeight: 600,
              textTransform: 'uppercase', transition: 'all 0.2s',
            }}
          >
            <Globe size={14} />
            {lang}
          </button>
        </div>
      </div>

      {showPlanModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowPlanModal(false); }}
        >
          <div style={{
            background: '#0f1117', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '20px', padding: '36px', maxWidth: '500px', width: '100%',
            boxShadow: '0 40px 120px rgba(0,0,0,0.8)',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#fff', margin: 0 }}>Upgrade your plan</h2>
                <p style={{ color: '#64748b', fontSize: '14px', marginTop: '6px' }}>Unlock more sites & API capacity</p>
              </div>
              <button onClick={() => setShowPlanModal(false)} style={{
                width: '32px', height: '32px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                color: '#64748b', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', fontSize: '18px',
              }}>×</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '28px' }}>
              {[
                { id: 'home', name: 'Home', price: '€49/mo', sites: '1 site', api: '100K calls/mo', color: '#6366f1' },
                { id: 'starter', name: 'Starter', price: '€299/mo', sites: '5 sites', api: '1M calls/mo', color: '#8b5cf6', trial: true },
                { id: 'pro', name: 'Pro', price: '€899/mo', sites: '20 sites', api: '10M calls/mo', color: '#a855f7', popular: true, trial: true },
                { id: 'enterprise', name: 'Enterprise', price: '€2,499/mo', sites: 'Unlimited', api: 'Unlimited', color: '#ec4899' },
              ].map(plan => (
                <a key={plan.id} href={`${BILLING_URL}/sign-in`} target="_blank" rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 18px',
                    borderRadius: '12px',
                    background: plan.popular ? `${plan.color}12` : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${plan.popular ? plan.color + '40' : 'rgba(255,255,255,0.07)'}`,
                    textDecoration: 'none', cursor: 'pointer',
                  }}
                >
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: plan.color, flexShrink: 0, boxShadow: `0 0 10px ${plan.color}80` }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#fff', fontWeight: '600', fontSize: '14px' }}>{plan.name}</span>
                      {plan.popular && <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '700', background: `${plan.color}30`, color: plan.color }}>POPULAR</span>}
                      {plan.trial && <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px', fontWeight: '600', background: '#10b98120', color: '#10b981' }}>14-day trial</span>}
                    </div>
                    <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>{plan.sites} · {plan.api}</div>
                  </div>
                  <span style={{ color: '#fff', fontWeight: '700', fontSize: '14px', whiteSpace: 'nowrap' }}>{plan.price}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
                </a>
              ))}
            </div>

            <p style={{ fontSize: '12px', color: '#475569', textAlign: 'center' }}>
              Manage your subscription at{' '}
              <a href={`${BILLING_URL}/dashboard`} target="_blank" rel="noopener noreferrer" style={{ color: '#6366f1', textDecoration: 'none' }}>
                billing.voltaris.io
              </a>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
