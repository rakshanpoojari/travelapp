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

    // Auto-select first suggestion if text is present but not selected
    let effectiveOrigin = originSelected;
    let effectiveDest = destSelected;

    const originText = originRef.current?.value || originQuery;
    const destText = destRef.current?.value || destQuery;

    if (!effectiveOrigin && originText) {
      const suggestions = await nominatimSearch(originText);
      if (suggestions.length > 0) {
        const s = suggestions[0];
        effectiveOrigin = { lat: s.lat, lng: s.lon || s.lng, label: s.label };
        // Don't update state/UI to avoid flicker, just use for search
        console.log('Auto-selected origin:', effectiveOrigin);
      }
    }

    if (!effectiveDest && destText) {
      const suggestions = await nominatimSearch(destText);
      if (suggestions.length > 0) {
        const s = suggestions[0];
        effectiveDest = { lat: s.lat, lng: s.lon || s.lng, label: s.label };
        console.log('Auto-selected destination:', effectiveDest);
      }
    }

    if (!effectiveOrigin || !effectiveDest) {
      alert('Please select valid locations for source and destination');
      return;
    }

    // Use lat/lng if available for better routing; fall back to text
    // Handle both 'lng' and 'lon' properties
    const originLng = effectiveOrigin?.lng || effectiveOrigin?.lon;
    const destLng = effectiveDest?.lng || effectiveDest?.lon;

    // Always use coordinates if we have them (which we should now)
    const originParam = (effectiveOrigin && effectiveOrigin.lat && originLng)
      ? `${effectiveOrigin.lat},${originLng}`
      : originText;
    const destParam = (effectiveDest && effectiveDest.lat && destLng)
      ? `${effectiveDest.lat},${destLng}`
      : destText;

    // Fetch transportation options and show popup
    setIsLoadingTransport(true);
    setShowTransportPopup(true);

    let options = [];
    try {
      options = await getTransportationOptions(effectiveOrigin, effectiveDest);
      setTransportOptions(options);
    } catch (error) {
      console.error('Failed to fetch transportation options:', error);
      setTransportOptions([]);
    } finally {
      setIsLoadingTransport(false);
    }

    // Also fetch route directions for map
    const modes = ['driving', 'transit', 'bicycling', 'walking'];

    // Check for multi-segment bus option to enhance transit visualization
    const multiSegmentOption = options.find(o => o.type === 'multi-segment' && o.mode === 'bus');

    const fetchDirections = async (mode) => {
      // Special handling for multi-segment transit
      if (mode === 'transit' && multiSegmentOption && multiSegmentOption.segments) {
        try {
          console.log('Fetching multi-segment transit route:', multiSegmentOption.segments);
          // Fetch directions for each segment specifically
          const segmentPromises = multiSegmentOption.segments.map(seg => {
            // Use segment cities as queries name
            return API.get(`/directions?origin=${encodeURIComponent(seg.from)}&destination=${encodeURIComponent(seg.to)}&mode=driving`); // Use driving for bus segments
          });

          const segmentResults = await Promise.all(segmentPromises);

          // Combine segments into one route object
          // Filter successfully fetched segments
          const validSegments = segmentResults.filter(r => r.data && r.data.status === 'OK');

          if (validSegments.length > 0) {
            const combinedRoute = {
              status: 'OK',
              routes: [{
                overview_path: validSegments.flatMap(r => r.data.routes[0].overview_path),
                legs: validSegments.flatMap(r => r.data.routes[0].legs),
                bounds: {
                  northeast: validSegments[0].data.routes[0].bounds?.northeast || {},
                  southwest: validSegments[validSegments.length - 1].data.routes[0].bounds?.southwest || {}
                },
                summary: multiSegmentOption.segments.map(s => `${s.from} -> ${s.to}`).join(', ')
              }]
            };
            return { mode: 'transit', data: combinedRoute };
          }
        } catch (err) {
          console.error('Failed to fetch individual segments, falling back to direct route', err);
        }
      }

      // Default behavior
      try {
        const r = await API.get(`/directions?origin=${encodeURIComponent(originParam)}&destination=${encodeURIComponent(destParam)}&mode=${mode}`);
        return { mode, data: r.data };
      } catch (e) {
        console.error(`Directions fetch failed for ${mode}`, e);
        return { mode, data: { status: 'ZERO_RESULTS', routes: [] } };
      }
    };

    try {
      const results = await Promise.all(modes.map(m => fetchDirections(m)));
      onRoutes(results);
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
            onChange={(e) => {
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
            onChange={(e) => {
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
