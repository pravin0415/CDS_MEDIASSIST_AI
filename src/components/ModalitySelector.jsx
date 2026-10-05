import React from 'react';

const MODALITIES = [
  { id: 'symptoms', label: 'Structured Symptoms', icon: '📝', desc: 'Select or describe clinical symptoms' },
  { id: 'voice', label: 'Voice Input', icon: '🎙️', desc: 'Record audio description (Whisper STT)' },
  { id: 'chest_xray', label: 'Chest X-Ray', icon: '🫁', desc: 'Upload chest radiograph (DenseNet-121)' },
  { id: 'skin_image', label: 'Skin Lesion', icon: '🩺', desc: 'Upload dermascopic photo (MobileNetV2)' },
];

export default function ModalitySelector({ activeModality, onSelectModality }) {
  return (
    <div style={{ marginBottom: '24px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '700', color: '#374151', marginBottom: '8px' }}>
        SELECT ASSESSMENT MODALITY
      </label>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
        }}
      >
        {MODALITIES.map((item) => {
          const isSelected = activeModality === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectModality(item.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '12px 14px',
                borderRadius: '8px',
                border: isSelected ? '2px solid #2563eb' : '1px solid #e5e7eb',
                backgroundColor: isSelected ? '#eff6ff' : '#ffffff',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                <span
                  style={{
                    fontSize: '0.9rem',
                    fontWeight: '700',
                    color: isSelected ? '#1e40af' : '#1f2937',
                  }}
                >
                  {item.label}
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', color: isSelected ? '#1d4ed8' : '#6b7280', lineHeight: '1.3' }}>
                {item.desc}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
