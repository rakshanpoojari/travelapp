import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet default icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export default function Map({ center = { lat: 12.97, lng: 77.59 }, routes = [], vehicle }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routeLayersRef = useRef([]);
  const vehicleMarkerRef = useRef(null);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView([center.lat, center.lng], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      // Cleanup on unmount
      if (mapInstanceRef.current) {
        mapInstanceRef.current.off();
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update routes
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear previous route layers
    routeLayersRef.current.forEach(layer => mapInstanceRef.current.removeLayer(layer));
    routeLayersRef.current = [];

    // Add new routes
    routes.forEach((route, idx) => {
      const path = route.overview_path || route.polylineDecoded || [];

      if (path && path.length > 0) {
        // Convert path to LatLng format
        const latlngs = path.map(p => [p.lat || p[0], p.lng || p[1]]);

        // Draw polyline
        const polyline = L.polyline(latlngs, {
          color: ['red', 'blue', 'green', 'purple', 'orange'][idx % 5],
          weight: 4,
          opacity: 0.8,
        }).addTo(mapInstanceRef.current);

        routeLayersRef.current.push(polyline);

        // Add start and end markers
        if (latlngs.length > 0) {
          const startMarker = L.marker(latlngs[0], {
            title: `Route ${idx + 1} Start`,
          }).addTo(mapInstanceRef.current);

          const endMarker = L.marker(latlngs[latlngs.length - 1], {
            title: `Route ${idx + 1} End`,
          }).addTo(mapInstanceRef.current);

          routeLayersRef.current.push(startMarker, endMarker);
        }
      }
    });
  }, [routes]);

  // Update vehicle position
  useEffect(() => {
    if (!mapInstanceRef.current || !vehicle) return;

    if (!vehicleMarkerRef.current) {
      vehicleMarkerRef.current = L.marker([vehicle.lat, vehicle.lng], {
        title: 'Vehicle',
        icon: L.icon({
          iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
          iconSize: [25, 41],
          iconAnchor: [12, 41],
        }),
      }).addTo(mapInstanceRef.current);
    } else {
      vehicleMarkerRef.current.setLatLng([vehicle.lat, vehicle.lng]);
    }
  }, [vehicle]);

  return (
    <div
      ref={mapRef}
      style={{
        width: '100%',
        height: '100%',
      }}
    />
  );
}
