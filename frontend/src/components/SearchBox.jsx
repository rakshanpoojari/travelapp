import React, { useRef } from 'react';
import API from '../services/api';

export default function SearchBox({ onRoutes }) {
  const originRef = useRef();
  const destRef = useRef();

  const search = async () => {
    const origin = originRef.current.value;
    const destination = destRef.current.value;
    // retrieve multiple modes: driving, transit, bicycling, walking
    const modes = ['driving','transit','bicycling','walking'];
    const promises = modes.map(m => API.get(`/directions?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=${m}`));
    const results = await Promise.all(promises);
    const mapped = results.map((r,i)=> ({ mode: modes[i], data: r.data }));
    onRoutes(mapped);
  };

  return (
    <div className="p-4">
      <input ref={originRef} placeholder="Origin" className="border p-2 mr-2" />
      <input ref={destRef} placeholder="Destination" className="border p-2 mr-2" />
      <button onClick={search} className="bg-blue-500 text-white p-2 rounded">Search</button>
    </div>
  );
}
