import React, { useRef, useState, useEffect } from 'react';
import API from '../services/api';

// Simple Nominatim search (OpenStreetMap). Debounced to reduce requests.
async function nominatimSearch(q) {
  if (!q || q.length < 2) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(q)}&addressdetails=1&limit=6`;
  try {
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.map(d => ({
      label: d.display_name,
      lat: parseFloat(d.lat),
      lon: parseFloat(d.lon),
      raw: d
    }));
  } catch (e) {
    return [];
  }
}

export default function SearchBox({ onRoutes }) {
  const originRef = useRef();
  const destRef = useRef();

  const [originQuery, setOriginQuery] = useState('');
  const [destQuery, setDestQuery] = useState('');
  const [originSuggestions, setOriginSuggestions] = useState([]);
  const [destSuggestions, setDestSuggestions] = useState([]);
  const [originSelected, setOriginSelected] = useState(null);
  const [destSelected, setDestSelected] = useState(null);

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
    setOriginSelected(s);
    setOriginQuery(s.label);
    setOriginSuggestions([]);
    if (originRef.current) originRef.current.value = s.label;
  };

  const pickDest = (s) => {
    setDestSelected(s);
    setDestQuery(s.label);
    setDestSuggestions([]);
    if (destRef.current) destRef.current.value = s.label;
  };

  const search = async () => {
    const originText = originRef.current?.value || originQuery;
    const destText = destRef.current?.value || destQuery;

    // Use lat/lon if available for better routing; fall back to text
    const originParam = originSelected ? `${originSelected.lat},${originSelected.lon}` : originText;
    const destParam = destSelected ? `${destSelected.lat},${destSelected.lon}` : destText;

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
    <div className="relative">
      <div className="flex items-center gap-2">
        <div className="relative w-64">
          <input
            ref={originRef}
            value={originQuery}
            onChange={(e)=>{ setOriginQuery(e.target.value); setOriginSelected(null); }}
            placeholder="Source"
            autoComplete="off"
            className="w-full rounded px-3 py-2 border border-slate-300 bg-white text-slate-900"
          />
          {originSuggestions.length > 0 && (
            <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 max-h-48 overflow-auto rounded shadow">
              {originSuggestions.map((s, idx) => (
                <li key={idx} onClick={()=>pickOrigin(s)} className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-sm">{s.label}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="relative w-64">
          <input
            ref={destRef}
            value={destQuery}
            onChange={(e)=>{ setDestQuery(e.target.value); setDestSelected(null); }}
            placeholder="Destination"
            autoComplete="off"
            className="w-full rounded px-3 py-2 border border-slate-300 bg-white text-slate-900"
          />
          {destSuggestions.length > 0 && (
            <ul className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 max-h-48 overflow-auto rounded shadow">
              {destSuggestions.map((s, idx) => (
                <li key={idx} onClick={()=>pickDest(s)} className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-sm">{s.label}</li>
              ))}
            </ul>
          )}
        </div>

        <button onClick={search} className="bg-indigo-600 text-white px-3 py-2 rounded">Search</button>
      </div>
    </div>
  );
}
