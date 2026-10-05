import React, { useState } from 'react';
import { useLanguage } from '../i18n';

export default function GradCamViewer({ originalUrl, heatmapUrl, targetClass, targetLayer, xaiNote }) {
  const { t } = useLanguage();
  const [opacity, setOpacity] = useState(0.75);
  const [viewMode, setViewMode] = useState('overlay'); // 'overlay' | 'sideBySide'

  if (!heatmapUrl) return null;

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
          🔥 {t('gradcamTitle')}
        </h4>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setViewMode('overlay')}
            style={{
              backgroundColor: viewMode === 'overlay' ? '#2563eb' : '#f3f4f6',
              color: viewMode === 'overlay' ? '#ffffff' : '#374151',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 10px',
              fontSize: '0.78rem',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            {t('blendOverlay')}
          </button>
          <button
            onClick={() => setViewMode('sideBySide')}
            style={{
              backgroundColor: viewMode === 'sideBySide' ? '#2563eb' : '#f3f4f6',
              color: viewMode === 'sideBySide' ? '#ffffff' : '#374151',
              border: 'none',
              borderRadius: '4px',
              padding: '4px 10px',
              fontSize: '0.78rem',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            {t('sideBySide')}
          </button>
        </div>
      </div>

      <p style={{ margin: '0 0 14px 0', fontSize: '0.85rem', color: '#4b5563' }}>
        Target Class: <strong>{targetClass || 'Predicted Finding'}</strong> {targetLayer && `(Target Layer: ${targetLayer})`}. Warmer regions (red/amber) indicate higher neural activation.
      </p>

      {/* Opacity Slider for Blend Overlay */}
      {viewMode === 'overlay' && (
        <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.82rem' }}>
          <span style={{ color: '#4b5563', fontWeight: '500' }}>Heatmap Intensity:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={opacity}
            onChange={(e) => setOpacity(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: '#2563eb' }}
          />
          <span style={{ minWidth: '40px', fontWeight: '600', color: '#1f2937' }}>{Math.round(opacity * 100)}%</span>
        </div>
      )}

      {/* Image Display Area */}
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
        {viewMode === 'overlay' ? (
          <div
            style={{
              position: 'relative',
              width: '320px',
              height: '320px',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid #d1d5db',
              backgroundColor: '#000000',
            }}
          >
            {/* Original Image */}
            {originalUrl ? (
              <img
                src={originalUrl}
                alt="Original Medical Study"
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : null}
            {/* Grad-CAM Heatmap Overlay */}
            <img
              src={heatmapUrl}
              alt="Grad-CAM Attention Map"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: opacity,
                mixBlendMode: 'screen',
              }}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {originalUrl && (
              <div style={{ textAlign: 'center' }}>
                <p style={{ margin: '0 0 4px 0', fontSize: '0.78rem', color: '#6b7280', fontWeight: '600' }}>{t('originalImage')}</p>
                <img
                  src={originalUrl}
                  alt="Original"
                  style={{ width: '240px', height: '240px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #d1d5db' }}
                />
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: '0.78rem', color: '#6b7280', fontWeight: '600' }}>{t('gradcam')}</p>
              <img
                src={heatmapUrl}
                alt="GradCAM Heatmap"
                style={{ width: '240px', height: '240px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #d1d5db' }}
              />
            </div>
          </div>
        )}
      </div>

      {xaiNote && (
        <p style={{ margin: '8px 0 0 0', fontSize: '0.78rem', color: '#6b7280', fontStyle: 'italic', textAlign: 'center' }}>
          {xaiNote}
        </p>
      )}
    </div>
  );
}
