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

export default function Map({ center = { lat: 12.97, lng: 77.59 }, routes = [], vehicle, locations = { origin: null, destination: null }, selectedMode = null }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const routeLayersRef = useRef([]);
  const vehicleMarkerRef = useRef(null);
  const originMarkerRef = useRef(null);
  const destinationMarkerRef = useRef(null);

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
    routes.forEach((routeObj, idx) => {
      // Handle structure: { mode: 'driving', data: { routes: [...] } }
      const routeData = routeObj.data || routeObj;
      const routeList = routeData.routes || (routeData.status === 'OK' ? routeData.routes : []);
      const route = Array.isArray(routeList) && routeList.length > 0 ? routeList[0] : routeData;
      
      // Get path from various possible locations
      const path = route.overview_path || route.geometry?.coordinates || route.polylineDecoded || [];

      if (path && path.length > 0) {
        // Convert path to LatLng format
        // Handle both [lat, lng] and [lng, lat] formats
        const latlngs = path.map(p => {
          if (Array.isArray(p)) {
            // If it's [lng, lat] format (GeoJSON), swap to [lat, lng]
            if (p.length === 2 && typeof p[0] === 'number' && typeof p[1] === 'number') {
              // Check if first is likely longitude (> 180 means it's lat, but for India, lng < lat)
              // For safety, if first number > 90, assume it's [lat, lng], else [lng, lat]
              return p[0] > 90 || p[0] < -90 ? [p[0], p[1]] : [p[1], p[0]];
            }
            return [p[0], p[1]];
          }
          return [p.lat || p[0], p.lng || p[1]];
        });

        // Map transportation modes to route modes
        // Note: Multiple transportation modes can map to the same route mode
        // The color will differentiate them (bus=blue, train=green both use transit route)
        const modeMapping = {
          'bus': 'transit',      // Bus uses transit route, highlighted in BLUE
          'train': 'transit',    // Train uses transit route, highlighted in GREEN
          'taxi': 'driving',     // Taxi uses driving route, highlighted in YELLOW
          'flight': 'driving'    // Flight uses driving route, highlighted in PURPLE
        };
        
        // Determine if this route should be highlighted
        const routeMode = routeObj.mode || 'driving';
        const isSelected = selectedMode && modeMapping[selectedMode.mode] === routeMode;
        
        // Debug logging for all routes when a mode is selected
        if (selectedMode) {
          console.log(`Route ${idx} (${routeMode}):`, {
            selectedMode: selectedMode.mode,
            routeMode,
            expectedMode: modeMapping[selectedMode.mode],
            isSelected,
            willHighlight: isSelected
          });
        }
        
        // Default color mapping for routes
        const modeColors = {
          'driving': '#3b82f6',    // blue
          'walking': '#10b981',    // green
          'bicycling': '#a855f7',  // purple
          'transit': '#f97316'     // orange
        };
        
        // Selected mode colors (these override default colors when selected)
        const selectedColors = {
          'bus': '#3b82f6',      // blue - same as driving but specifically for bus
          'train': '#10b981',    // green
          'taxi': '#eab308',     // yellow
          'flight': '#a855f7'    // purple
        };
        
        // Determine color, weight, and opacity
        let color;
        let weight;
        let opacity;
        
        if (isSelected) {
          // Highlight selected route with mode-specific color
          color = selectedColors[selectedMode.mode] || modeColors[routeMode] || '#3b82f6';
          weight = 7; // Thicker for better visibility
          opacity = 1.0;
          
          console.log(`✅ Highlighting ${selectedMode.mode} route in ${color}`, {
            mode: selectedMode.mode,
            routeMode,
            color,
            weight,
            opacity
          });
        } else if (selectedMode) {
          // Dim non-selected routes when a mode is selected
          color = modeColors[routeMode] || '#3b82f6';
          weight = 2;
          opacity = 0.15; // More dimmed
        } else {
          // Normal display when no mode is selected
          color = modeColors[routeMode] || '#3b82f6';
          weight = 4;
          opacity = 0.6;
        }
        
        const polyline = L.polyline(latlngs, {
          color: color,
          weight: weight,
          opacity: opacity,
        }).addTo(mapInstanceRef.current);
        
        // Bring selected route to front for better visibility
        if (isSelected) {
          polyline.bringToFront();
          // Add a pulsing effect by bringing to front multiple times
          setTimeout(() => polyline.bringToFront(), 100);
        }

        routeLayersRef.current.push(polyline);

        // Add start and end markers (only for first route of each mode to avoid clutter)
        if (latlngs.length > 0 && idx < 4) {
          const startMarker = L.marker(latlngs[0], {
            title: `${routeMode} Route Start`,
          }).addTo(mapInstanceRef.current);

          const endMarker = L.marker(latlngs[latlngs.length - 1], {
            title: `${routeMode} Route End`,
          }).addTo(mapInstanceRef.current);

          routeLayersRef.current.push(startMarker, endMarker);
        }
      }
    });
  }, [routes, selectedMode]);

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

  // Update origin and destination markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Handle origin marker
    if (locations.origin) {
      // Validate coordinates - handle both 'lng' and 'lon' properties
      const originLat = locations.origin.lat;
      const originLng = locations.origin.lng || locations.origin.lon;
      
      if (originLat != null && originLng != null && !isNaN(originLat) && !isNaN(originLng)) {
        if (!originMarkerRef.current) {
          // Create green marker for origin
          originMarkerRef.current = L.marker([originLat, originLng], {
            title: `Source: ${locations.origin.label || 'Origin'}`,
            icon: L.icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
            }),
          }).addTo(mapInstanceRef.current);
          originMarkerRef.current.bindPopup(`<b>Source</b><br>${locations.origin.label || 'Origin'}`).openPopup();
        } else {
          originMarkerRef.current.setLatLng([originLat, originLng]);
          originMarkerRef.current.setPopupContent(`<b>Source</b><br>${locations.origin.label || 'Origin'}`);
          originMarkerRef.current.openPopup();
        }
      } else {
        console.warn('Invalid origin coordinates:', locations.origin, {
          lat: originLat,
          lng: originLng,
          hasLat: originLat != null,
          hasLng: originLng != null
        });
      }
    } else {
      // Remove origin marker if location is cleared
      if (originMarkerRef.current) {
        mapInstanceRef.current.removeLayer(originMarkerRef.current);
        originMarkerRef.current = null;
      }
    }

    // Handle destination marker
    if (locations.destination) {
      // Validate coordinates - handle both 'lng' and 'lon' properties
      const destLat = locations.destination.lat;
      const destLng = locations.destination.lng || locations.destination.lon;
      
      if (destLat != null && destLng != null && !isNaN(destLat) && !isNaN(destLng)) {
        if (!destinationMarkerRef.current) {
          // Create red marker for destination
          destinationMarkerRef.current = L.marker([destLat, destLng], {
            title: `Destination: ${locations.destination.label || 'Destination'}`,
            icon: L.icon({
              iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
              iconSize: [25, 41],
              iconAnchor: [12, 41],
              popupAnchor: [1, -34],
            }),
          }).addTo(mapInstanceRef.current);
          destinationMarkerRef.current.bindPopup(`<b>Destination</b><br>${locations.destination.label || 'Destination'}`).openPopup();
        } else {
          destinationMarkerRef.current.setLatLng([destLat, destLng]);
          destinationMarkerRef.current.setPopupContent(`<b>Destination</b><br>${locations.destination.label || 'Destination'}`);
          destinationMarkerRef.current.openPopup();
        }
      } else {
        console.warn('Invalid destination coordinates:', locations.destination);
      }
    } else {
      // Remove destination marker if location is cleared
      if (destinationMarkerRef.current) {
        mapInstanceRef.current.removeLayer(destinationMarkerRef.current);
        destinationMarkerRef.current = null;
      }
    }

    // Fit map to show both markers if both exist
    if (locations.origin && locations.destination && originMarkerRef.current && destinationMarkerRef.current) {
      const group = L.featureGroup([
        originMarkerRef.current,
        destinationMarkerRef.current
      ]);
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.1));
    } else if (locations.origin && originMarkerRef.current) {
      const originLat = locations.origin.lat;
      const originLng = locations.origin.lng || locations.origin.lon;
      if (originLat != null && originLng != null) {
        mapInstanceRef.current.setView([originLat, originLng], 13);
      }
    } else if (locations.destination && destinationMarkerRef.current) {
      const destLat = locations.destination.lat;
      const destLng = locations.destination.lng || locations.destination.lon;
      if (destLat != null && destLng != null) {
        mapInstanceRef.current.setView([destLat, destLng], 13);
      }
    }
  }, [locations]);

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
