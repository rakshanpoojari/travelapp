import { GoogleMap, useJsApiLoader, Polyline, Marker } from '@react-google-maps/api';

const containerStyle = { width: '100%', height: '600px' };

// Keep libraries as a stable constant to avoid reloading the script
const GOOGLE_MAP_LIBS = ['places'];

export default function Map({ center = { lat: 12.97, lng: 77.59 }, routes = [], vehicle }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY ?? '';

  // Call hook unconditionally to preserve hook order
  const { isLoaded, loadError } = useJsApiLoader({ googleMapsApiKey: apiKey, libraries: GOOGLE_MAP_LIBS });

  if (!apiKey) {
    return (
      <div style={{ color: 'red' }}>
        Missing Google Maps key. Add <code>VITE_GOOGLE_MAPS_KEY=AIza...your-key...</code> to <code>frontend/.env</code> and restart the dev server.
      </div>
    );
  }

  if (loadError) {
    return <div style={{ color: 'red' }}>Map failed to load: {String(loadError)}</div>;
  }

  if (!isLoaded) return <div>Loading map..</div>;

  return (
    <GoogleMap mapContainerStyle={containerStyle} center={center} zoom={13}>
      {routes.map((r, i) => {
        // expect r.polyline = encoded polyline or array of latlng
        const path = r.overview_path || r.polylineDecoded || [];
        return <Polyline key={i} path={path} options={{ strokeWeight: 4, clickable: false }} />;
      })}
      {vehicle && <Marker position={vehicle} />}
    </GoogleMap>
  );
}
