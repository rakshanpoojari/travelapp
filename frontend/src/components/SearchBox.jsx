import React, { useRef, useState, useEffect } from 'react';
import API from '../services/api';
import { getTransportationOptions } from '../services/transportationApi';
import TransportationOptionsPopup from './TransportationOptionsPopup';

// Simple Nominatim search (OpenStreetMap). Debounced to reduce requests.
async function nominatimSearch(q) {
  if (!q || q.length < 2) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&addressdetails=1&limit=6`;
  try {
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!res.ok) return [];
    const data = await res.json();
    return data
      .filter(d => d.lat && d.lon && !isNaN(parseFloat(d.lat)) && !isNaN(parseFloat(d.lon))) // Pre-filter valid data
      .map(d => ({
        label: d.display_name,
        lat: parseFloat(d.lat),
        lon: parseFloat(d.lon),
        raw: d
      }))
      .filter(d => !isNaN(d.lat) && !isNaN(d.lon)); // Filter out invalid coordinates
  } catch {
    return [];
  }
}

export default function SearchBox({ onRoutes, onLocationsChange, onSelectMode }) {
  const originRef = useRef();
  const destRef = useRef();

  const [originQuery, setOriginQuery] = useState('');
  const [destQuery, setDestQuery] = useState('');
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [destSuggestions, setDestSuggestions] = useState([]);
  const [originSelected, setOriginSelected] = useState(null);
  const [destSelected, setDestSelected] = useState(null);
  const [showTransportPopup, setShowTransportPopup] = useState(false);
  const [transportOptions, setTransportOptions] = useState([]);
  const [isLoadingTransport, setIsLoadingTransport] = useState(false);

  // debounced effect for origin
  useEffect(() => {
    const id = setTimeout(async () => {
      if (originQuery && originQuery.length >= 2) {
        const s = await nominatimSearch(originQuery);
        setOriginSuggestions(s);
      } else {
        setOriginSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [originQuery]);

  // debounced effect for destination
  useEffect(() => {
    const id = setTimeout(async () => {
      if (destQuery && destQuery.length >= 2) {
        const s = await nominatimSearch(destQuery);
        setDestSuggestions(s);
      } else {
        setDestSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [destQuery]);

  const pickOrigin = (s) => {
    console.log('Picking origin:', s.label);
    // Normalize to use 'lng' instead of 'lon'
    const normalized = {
      lat: s.lat,
      lng: s.lon || s.lng,
      label: s.label
    };

    console.log('About to validate origin:', normalized);
    // Validate coordinates - check for valid numbers
    if (isNaN(parseFloat(normalized.lat)) || isNaN(parseFloat(normalized.lng))) {
      console.error('Invalid origin coordinates:', normalized);
      alert('Invalid location coordinates. Please try another location.');
      return;
    }

    setOriginSelected(normalized);
    setOriginQuery(s.label);
    setOriginSuggestions([]);

    // Update input value directly
    if (originRef.current) {
      originRef.current.value = s.label;
    }

    // Notify parent about location change
    if (onLocationsChange) {
      onLocationsChange({
        origin: normalized,
        destination: destSelected ? { lat: destSelected.lat, lng: destSelected.lng || destSelected.lon, label: destSelected.label } : null
      });
    }

    console.log('Origin selected:', { lat: normalized.lat, lng: normalized.lng, label: normalized.label });
  };

  const pickDest = (s) => {
    console.log('Picking destination:', s.label);
    // Normalize to use 'lng' instead of 'lon'
    const normalized = {
      lat: s.lat,
      lng: s.lon || s.lng,
      label: s.label
    };

    // Validate coordinates - check for valid numbers
    if (isNaN(parseFloat(normalized.lat)) || isNaN(parseFloat(normalized.lng))) {
      console.error('Invalid destination coordinates:', normalized);
      alert('Invalid location coordinates. Please try another location.');
      return;
    }

    setDestSelected(normalized);
    setDestQuery(s.label);
    setDestSuggestions([]);

    // Update input value directly
    if (destRef.current) {
      destRef.current.value = s.label;
    }

    // Normalize origin if it exists
    const normalizedOrigin = originSelected ? {
      lat: originSelected.lat,
      lng: originSelected.lng || originSelected.lon,
      label: originSelected.label
    } : null;

    // Notify parent about location change
    if (onLocationsChange) {
      onLocationsChange({
        origin: normalizedOrigin,
        destination: normalized
      });
    }

    console.log('Destination selected:', { lat: normalized.lat, lng: normalized.lng, label: normalized.label });
  };

  const search = async () => {
    // Clear suggestions when search is clicked
    setOriginSuggestions([]);
    setDestSuggestions([]);
    
    // Check if both origin and destination are selected
    if (!originSelected || !destSelected) {
      alert('Please select both source and destination from the suggestions');
      return;
    }
    
    const originText = originRef.current?.value || originQuery;
    const destText = destRef.current?.value || destQuery;

    // Use lat/lng if available for better routing; fall back to text
    // Handle both 'lng' and 'lon' properties
    const originLng = originSelected?.lng || originSelected?.lon;
    const destLng = destSelected?.lng || destSelected?.lon;
    
    const originParam = (originSelected && originSelected.lat && originLng) 
      ? `${originSelected.lat},${originLng}` 
      : originText;
    const destParam = (destSelected && destSelected.lat && destLng) 
      ? `${destSelected.lat},${destLng}` 
      : destText;

    // Fetch transportation options and show popup
    setIsLoadingTransport(true);
    setShowTransportPopup(true);
    
    try {
      const options = await getTransportationOptions(originSelected, destSelected);
      setTransportOptions(options);
    } catch (error) {
      console.error('Failed to fetch transportation options:', error);
      setTransportOptions([]);
    } finally {
      setIsLoadingTransport(false);
    }

    // Also fetch route directions for map
    const modes = ['driving','transit','bicycling','walking'];
    const promises = modes.map(m => API.get(`/directions?origin=${encodeURIComponent(originParam)}&destination=${encodeURIComponent(destParam)}&mode=${m}`));
    try {
      const results = await Promise.all(promises);
      const mapped = results.map((r,i)=> ({ mode: modes[i], data: r.data }));
      onRoutes(mapped);
    } catch (e) {
      console.error('Directions fetch failed', e);
      onRoutes([]);
    }
  };

  return (
    <div className="relative z-[9999]">
      <div className="flex items-center gap-2">
        <div className="relative w-64 z-[10000]">
          <input
            ref={originRef}
            value={originQuery}
            onChange={(e)=>{ 
              setOriginQuery(e.target.value); 
              setOriginSelected(null);
              // Clear origin location when user types
              if (onLocationsChange) {
                onLocationsChange({
                  origin: null,
                  destination: destSelected ? { lat: destSelected.lat, lng: destSelected.lon, label: destSelected.label } : null
                });
              }
            }}
            onBlur={(e) => {
              // Clear suggestions when input loses focus (with delay to allow click on suggestion)
              // Only clear if the blur is not caused by clicking on a suggestion
              setTimeout(() => {
                // Check if suggestions are still visible and input hasn't been refocused
                if (originSuggestions.length > 0 && document.activeElement !== e.target) {
                  setOriginSuggestions([]);
                }
              }, 250);
            }}
            onFocus={() => {
              // Keep suggestions visible when input is focused
              // This helps if user clicks back into the input
            }}
            placeholder="Source"
            autoComplete="off"
            className="w-full rounded px-3 py-2 border border-slate-300 bg-white text-slate-900"
          />
          {originSuggestions.length > 0 && (
            <ul className="absolute z-[10001] left-0 right-0 mt-1 bg-white border border-slate-200 max-h-48 overflow-auto rounded shadow-lg">
              {originSuggestions.map((s, idx) => (
                <li 
                  key={idx} 
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent input blur
                    e.stopPropagation(); // Stop event bubbling
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    pickOrigin(s);
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    pickOrigin(s);
                  }}
                  className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-sm active:bg-slate-200"
                >
                  {s.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="relative w-64 z-[10000]">
          <input
            ref={destRef}
            value={destQuery}
            onChange={(e)=>{ 
              setDestQuery(e.target.value); 
              setDestSelected(null);
              // Clear destination location when user types
              if (onLocationsChange) {
                onLocationsChange({
                  origin: originSelected ? { lat: originSelected.lat, lng: originSelected.lon, label: originSelected.label } : null,
                  destination: null
                });
              }
            }}
            onBlur={(e) => {
              // Clear suggestions when input loses focus (with delay to allow click on suggestion)
              // Only clear if the blur is not caused by clicking on a suggestion
              setTimeout(() => {
                // Check if suggestions are still visible and input hasn't been refocused
                if (destSuggestions.length > 0 && document.activeElement !== e.target) {
                  setDestSuggestions([]);
                }
              }, 250);
            }}
            onFocus={() => {
              // Keep suggestions visible when input is focused
              // This helps if user clicks back into the input
            }}
            placeholder="Destination"
            autoComplete="off"
            className="w-full rounded px-3 py-2 border border-slate-300 bg-white text-slate-900"
          />
          {destSuggestions.length > 0 && (
            <ul className="absolute z-[10001] left-0 right-0 mt-1 bg-white border border-slate-200 max-h-48 overflow-auto rounded shadow-lg">
              {destSuggestions.map((s, idx) => (
                <li 
                  key={idx} 
                  onMouseDown={(e) => {
                    e.preventDefault(); // Prevent input blur
                    e.stopPropagation(); // Stop event bubbling
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    pickDest(s);
                  }}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    pickDest(s);
                  }}
                  className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-sm active:bg-slate-200"
                >
                  {s.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button onClick={search} className="bg-indigo-600 text-white px-3 py-2 rounded">Search</button>
      </div>
      
      {/* Transportation Options Popup */}
      <TransportationOptionsPopup
        isOpen={showTransportPopup}
        onClose={() => setShowTransportPopup(false)}
        options={isLoadingTransport ? [] : transportOptions}
        origin={originSelected}
        destination={destSelected}
        onSelectMode={onSelectMode}
      />
    </div>
  );
}
