import React, { useState } from 'react';
import { useLanguage } from '../i18n';

export default function NearbyFacilities({ apiBaseUrl = 'http://localhost:8000', initialKind = 'hospital' }) {
  const { t } = useLanguage();
  const [kind, setKind] = useState(initialKind);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [facilities, setFacilities] = useState([]);
  const [searched, setSearched] = useState(false);
  const [location, setLocation] = useState(null);
  const [radiusKm, setRadiusKm] = useState(3);

  const fetchNearby = (lat, lon, radius = 3) => {
    setLoading(true);
    setError(null);

    fetch(`${apiBaseUrl}/api/nearby-doctors?lat=${lat}&lon=${lon}&radius_km=${radius}&kind=${kind}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch nearby care locations.');
        return res.json();
      })
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setFacilities(data.facilities || []);
        setRadiusKm(radius);
        setSearched(true);
      })
      .catch((err) => {
      setError(err.message || 'Could not query OpenStreetMap.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleUseLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const gps = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setLocation(gps);
        fetchNearby(gps.lat, gps.lon, 3);
      },
      (err) => {
        setLoading(false);
        setError(`Location access denied or unavailable (${err.message}). Allow location access to find real nearby facilities.`);
      },
      { timeout: 10000 }
    );
  };

  return (
    <div
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: '10px',
        padding: '20px',
        marginTop: '20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <button type="button" aria-pressed={kind === 'hospital'}
          style={{ fontWeight: kind === 'hospital' ? 700 : 400, borderColor: kind === 'hospital' ? '#2563eb' : '#cbd5e1' }}
          onClick={() => { setKind('hospital'); setSearched(false); setFacilities([]); }}>
          {t('nearbyHospitals')}
        </button>
        <button type="button" aria-pressed={kind === 'doctor'}
          style={{ fontWeight: kind === 'doctor' ? 700 : 400, borderColor: kind === 'doctor' ? '#2563eb' : '#cbd5e1' }}
          onClick={() => { setKind('doctor'); setSearched(false); setFacilities([]); }}>
          {t('nearbyDoctors')}
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '1.05rem', color: '#1f2937', fontWeight: '700' }}>
            📍 {kind === 'hospital' ? t('nearbyHospitals') : t('nearbyDoctors')}
          </h4>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
            {kind === 'hospital' ? t('nearbyDescription') : t('nearbyDoctorsDescription')} {searched && `${t('searchRadius')}: ${radiusKm} km.`}
          </p>
        </div>

        <button
          type="button"
          onClick={handleUseLocation}
          disabled={loading}
          style={{
            backgroundColor: '#2563eb',
            color: '#ffffff',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 14px',
            fontSize: '0.85rem',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {loading ? t('searching') : kind === 'hospital' ? t('findHospitals') : t('findDoctors')}
        </button>
      </div>

      {error && (
        <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b', padding: '8px 12px', borderRadius: '6px', fontSize: '0.82rem', marginBottom: '12px' }}>
          {error}
        </div>
      )}

      {searched && facilities.length === 0 && !loading && (
        <p style={{ fontSize: '0.85rem', color: '#6b7280', fontStyle: 'italic', margin: '12px 0' }}>
          {kind === 'hospital' ? t('noHospitalWithin') : t('noDoctorWithin')} {radiusKm} km. {t('noHospitalCaveat')}
        </p>
      )}

      {searched && radiusKm === 3 && location && !loading && (
        <button type="button" onClick={() => fetchNearby(location.lat, location.lon, 5)}>
          {t('expandHospitalSearch')}
        </button>
      )}

      {facilities.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', marginTop: '14px' }}>
          {facilities.map((fac) => (
            <div
              key={fac.id}
              style={{
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                padding: '12px',
                backgroundColor: '#f9fafb',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                  <h5 style={{ margin: 0, fontSize: '0.9rem', color: '#111827', fontWeight: '700' }}>{fac.name}</h5>
                  <span style={{ backgroundColor: '#dbeafe', color: '#1e40af', fontSize: '0.7rem', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                    {fac.distance_km} {t('kmAway')}
                  </span>
                </div>
                <p style={{ margin: '0 0 6px 0', fontSize: '0.78rem', color: '#4b5563' }}>{fac.address}</p>
                  <p style={{ margin: '0 0 6px 0', fontSize: '0.78rem', color: '#4b5563' }}>
                    {kind === 'hospital' ? t('hospitalMapType') : `${t('mappedType')}: ${fac.type}`}
                  </p>
                {fac.emergency && (
                  <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', fontSize: '0.7rem', fontWeight: '700', padding: '2px 6px', borderRadius: '4px', display: 'inline-block', marginBottom: '6px' }}>
                    🚨 {t('emergency')}
                  </span>
                )}
              </div>

              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>📞 {fac.phone || t('notListed')}</span>
                <a
                  href={fac.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: '0.78rem', color: '#2563eb', fontWeight: '600', textDecoration: 'none' }}
                >
                  {t('directions')} ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
      {searched && <p style={{ fontSize: '0.75rem', color: '#6b7280' }}>
        {t('hospitalMapLimitations')} {kind === 'doctor' && t('doctorMapCaveat')}
      </p>}
    </div>
  );
}
