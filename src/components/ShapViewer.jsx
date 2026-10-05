import React from 'react';
import { useLanguage } from '../i18n';

export default function ShapViewer({ xaiData, predictedDisease }) {
  const { t } = useLanguage();
  if (!xaiData) return null;

  const {
    method,
    target_disease,
    base_value,
    net_score,
    top_positive_contributors = [],
    top_negative_contributors = [],
    about,
    confidence_note,
  } = xaiData;

  const targetName = target_disease || predictedDisease || 'Predicted Class';

  // Calculate max magnitude for bar chart scaling
  const allContribs = [...top_positive_contributors, ...top_negative_contributors];
  // The API returns `contribution` from XGBoost's native Tree SHAP output.
  // Keep the fallback for reports saved by an older version of the app.
  const contributionOf = (item) => Number(item.contribution ?? item.shap_value ?? 0);
  const maxVal = Math.max(...allContribs.map((item) => Math.abs(contributionOf(item))), 0.5);

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '10px',
        padding: '20px',
        marginTop: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#1f2937', fontWeight: '700' }}>
          🌳 {t('shapTitle')}
        </h4>
        <span
          style={{
            backgroundColor: '#eff6ff',
            color: '#1d4ed8',
            fontSize: '0.75rem',
            fontWeight: '600',
            padding: '2px 8px',
            borderRadius: '4px',
            border: '1px solid #bfdbfe',
          }}
        >
          {method || 'SHAP'} Explainer
        </span>
      </div>

      <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: '#4b5563' }}>
        Explaining target condition: <strong>{targetName}</strong>. Positive values push the model score toward this condition; negative values push away.
      </p>

      {/* SHAP Summary Stats Bar */}
      {(base_value !== undefined || net_score !== undefined) && (
        <div
          style={{
            display: 'flex',
            gap: '16px',
            backgroundColor: '#f9fafb',
            padding: '10px 14px',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '0.82rem',
          }}
        >
          <div>
            <span style={{ color: '#6b7280' }}>Baseline (Base Value):</span>{' '}
            <strong style={{ color: '#374151' }}>{base_value !== undefined ? base_value.toFixed(4) : 'N/A'}</strong>
          </div>
          <div>
            <span style={{ color: '#6b7280' }}>Net SHAP Output:</span>{' '}
            <strong style={{ color: '#374151' }}>{net_score !== undefined ? net_score.toFixed(4) : 'N/A'}</strong>
          </div>
        </div>
      )}

      {/* Positive Contributors */}
      <div style={{ marginBottom: '16px' }}>
        <h5 style={{ margin: '0 0 8px 0', fontSize: '0.88rem', color: '#dc2626', fontWeight: '600' }}>
          ➕ Positive Contributors (Increased Score)
        </h5>
        {top_positive_contributors.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: '#9ca3af', italic: 'true' }}>No positive feature contributions recorded.</p>
        ) : (
          top_positive_contributors.map((item, idx) => {
            const contribution = contributionOf(item);
            const widthPct = Math.min(100, Math.max(8, (Math.abs(contribution) / maxVal) * 100));
            return (
              <div key={idx} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '2px' }}>
                  <span style={{ color: '#1f2937', fontWeight: '500' }}>
                    {item.feature || item.symptom} {(item.is_present ?? item.present) ? '(Present)' : '(Absent)'}
                  </span>
                  <span style={{ color: '#dc2626', fontWeight: '600' }}>+{contribution.toFixed(4)}</span>
                </div>
                <div style={{ backgroundColor: '#fee2e2', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                  <div
                    style={{
                      backgroundColor: '#ef4444',
                      height: '100%',
                      width: `${widthPct}%`,
                      borderRadius: '4px',
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Negative Contributors */}
      <div style={{ marginBottom: '12px' }}>
        <h5 style={{ margin: '0 0 8px 0', fontSize: '0.88rem', color: '#2563eb', fontWeight: '600' }}>
          ➖ Negative Contributors (Decreased Score)
        </h5>
        {top_negative_contributors.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: '#9ca3af', fontStyle: 'italic' }}>No negative feature contributions recorded.</p>
        ) : (
          top_negative_contributors.map((item, idx) => {
            const contribution = contributionOf(item);
            const widthPct = Math.min(100, Math.max(8, (Math.abs(contribution) / maxVal) * 100));
            return (
              <div key={idx} style={{ marginBottom: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: '2px' }}>
                  <span style={{ color: '#1f2937', fontWeight: '500' }}>
                    {item.feature || item.symptom} {(item.is_present ?? item.present) ? '(Present)' : '(Absent)'}
                  </span>
                  <span style={{ color: '#2563eb', fontWeight: '600' }}>{contribution.toFixed(4)}</span>
                </div>
                <div style={{ backgroundColor: '#dbeafe', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                  <div
                    style={{
                      backgroundColor: '#3b82f6',
                      height: '100%',
                      width: `${widthPct}%`,
                      borderRadius: '4px',
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>

      {(about || confidence_note) && (
        <div style={{ backgroundColor: '#f9fafb', padding: '10px 12px', borderRadius: '6px', fontSize: '0.78rem', color: '#4b5563' }}>
          {about && <p style={{ margin: '0 0 4px 0' }}>{about}</p>}
          {confidence_note && <p style={{ margin: 0, fontStyle: 'italic' }}>{confidence_note}</p>}
        </div>
      )}
    </div>
  );
}
