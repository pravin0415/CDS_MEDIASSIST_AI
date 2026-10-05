import React from 'react';
import { useLanguage } from '../i18n';

const TIER_CONFIG = {
  CRITICAL: {
    label: 'CRITICAL / TIME-SENSITIVE',
    bgColor: '#fee2e2',
    borderColor: '#ef4444',
    textColor: '#991b1b',
    badgeColor: '#dc2626',
    icon: '🚨',
  },
  HIGH_URGENCY: {
    label: 'HIGH URGENCY',
    bgColor: '#ffedd5',
    borderColor: '#f97316',
    textColor: '#9a3412',
    badgeColor: '#ea580c',
    icon: '⚠️',
  },
  MODERATE: {
    label: 'MODERATE URGENCY',
    bgColor: '#fef9c3',
    borderColor: '#eab308',
    textColor: '#854d0e',
    badgeColor: '#ca8a04',
    icon: '🟡',
  },
  MILD: {
    label: 'MILD / SELF-CARE',
    bgColor: '#dcfce7',
    borderColor: '#22c55e',
    textColor: '#166534',
    badgeColor: '#16a34a',
    icon: '🟢',
  },
  UNCERTAIN: {
    label: 'UNCERTAIN / AMBIGUOUS SIGNAL',
    bgColor: '#f3f4f6',
    borderColor: '#9ca3af',
    textColor: '#374151',
    badgeColor: '#4b5563',
    icon: '❓',
  },
  OBSERVATIONAL: {
    label: 'OBSERVATIONAL (HARDWARE)',
    bgColor: '#f3e8ff',
    borderColor: '#a855f7',
    textColor: '#6b21a8',
    badgeColor: '#9333ea',
    icon: '🔬',
  },
};

export default function SeverityBadge({ decisionSupport, decisionTier, disclaimer }) {
  const { t } = useLanguage();
  const tier = decisionTier || decisionSupport?.decision_tier || 'UNCERTAIN';
  const config = TIER_CONFIG[tier] || TIER_CONFIG.UNCERTAIN;
  const rationale = decisionSupport?.clinical_rationale;
  const action = decisionSupport?.action_recommendation || decisionSupport?.patient_action;

  return (
    <div
      style={{
        backgroundColor: config.bgColor,
        borderLeft: `6px solid ${config.borderColor}`,
        borderRadius: '8px',
        padding: '16px 20px',
        marginBottom: '20px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '1.4rem' }}>{config.icon}</span>
          <span
            style={{
              backgroundColor: config.badgeColor,
              color: '#ffffff',
              fontSize: '0.85rem',
              fontWeight: '700',
              padding: '4px 10px',
              borderRadius: '9999px',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            {config.label}
          </span>
        </div>
      </div>

      {rationale && (
        <p style={{ margin: '8px 0 4px 0', color: config.textColor, fontWeight: '600', fontSize: '0.95rem' }}>
          {rationale}
        </p>
      )}

      {action && (
        <p style={{ margin: '4px 0 8px 0', color: config.textColor, fontSize: '0.9rem', lineHeight: '1.4' }}>
          <strong>{t('recommendedAction')}:</strong> {action}
        </p>
      )}

      <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: `1px solid ${config.borderColor}40` }}>
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280', fontStyle: 'italic' }}>
          {disclaimer || decisionSupport?.disclaimer || "MediAssist AI provides artificial intelligence screening decision support for clinical guidance only."}
        </p>
      </div>
    </div>
  );
}
