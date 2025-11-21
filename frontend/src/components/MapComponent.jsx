// src/components/MapComponent.jsx
import React from 'react';
import { useJsApiLoader, GoogleMap } from '@react-google-maps/api';

// Stable libraries array (defined once)
const GOOGLE_MAPS_LIBS = ['places'];

export default function MapComponent() {
  // Vite env variable (must be in frontend/.env as VITE_GOOGLE_MAPS_KEY)
  const apiKey = import.meta?.env?.VITE_GOOGLE_MAPS_KEY ?? '';

  if (!apiKey) {
    return (
      <div style={{ color: 'red' }}>
        Missing Google Maps key. Add <code>VITE_GOOGLE_MAPS_KEY=AIza...your-key...</code> to <code>frontend/.env</code> and restart the dev server.
      </div>
    );
  }

  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBS,
  });

  if (loadError) {
    return <div style={{ color: 'red' }}>Map failed to load: {String(loadError)}</div>;
  }
  if (!isLoaded) {
    return <div>Loading map…</div>;
  }

  return (
    <GoogleMap
      center={{ lat: 12.9716, lng: 77.5946 }}
      zoom={12}
      mapContainerStyle={{ width: '100%', height: '400px' }}
    />
  );
}
