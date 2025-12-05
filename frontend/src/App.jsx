import React, { useState, useEffect, useRef } from 'react';
import Map from './components/Map';
import SearchBox from './components/SearchBox';
import { io } from 'socket.io-client';
import AIChatSidebar from './components/AIChatSidebar';
import SelectedModePanel from './components/SelectedModePanel';

function App(){
  const [routes, setRoutes] = useState([]);
  const [vehicle, setVehicle] = useState(null);
  const [socketStatus, setSocketStatus] = useState('disconnected');
  const [locations, setLocations] = useState({ origin: null, destination: null });
  const [selectedMode, setSelectedMode] = useState(null);
  const socketRef = useRef(null);

  // initialize socket inside effect to avoid top-level connection attempts
  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_WS || 'http://localhost:5000', { autoConnect: true });

    const onConnect = () => setSocketStatus('connected');
    const onDisconnect = () => setSocketStatus('disconnected');
    const onConnectError = (err) => {
      console.warn('Socket connect_error', err);
      setSocketStatus('error');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('vehicle-location', (v) => setVehicle({ lat: v.lat, lng: v.lng }));

    socketRef.current = socket;
    return () => {
      if (socketRef.current) {
        socketRef.current.off('connect', onConnect);
        socketRef.current.off('disconnect', onDisconnect);
        socketRef.current.off('connect_error', onConnectError);
        socketRef.current.off('vehicle-location');
        socketRef.current.disconnect();
      }
    };
  }, []);

  return (
    <div className="h-screen flex flex-col">
      {/* Status bar */}
      <div className="relative z-[9998] bg-white/10 backdrop-blur-md border-b border-white/20 p-3 flex gap-4 items-center shadow-lg">
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Multimodal Transportation</h1>
        </div>
        <div className="flex-1">
          <SearchBox
            onRoutes={(r)=> setRoutes(r)}
            onLocationsChange={(loc) => setLocations(loc)}
            onSelectMode={(option) => {
              console.log('App: Setting selected mode:', option.mode);
              setSelectedMode(option);
            }}
          />
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-600">Status:</span>
          {socketStatus === 'connected' ? (
            <span className="flex items-center gap-1 text-green-600 font-medium">
              <div className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></div>
              Connected
            </span>
          ) : socketStatus === 'error' ? (
            <span className="flex items-center gap-1 text-red-600 font-medium">
              <div className="w-2 h-2 bg-red-600 rounded-full"></div>
              Error
            </span>
          ) : (
            <span className="flex items-center gap-1 text-orange-600 font-medium">
              <div className="w-2 h-2 bg-orange-600 rounded-full animate-pulse"></div>
              Disconnected
            </span>
          )}
        </div>
      </div>

      {/* Main layout: sidebar + map */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left column: Sidebar */}
        <div className="flex-none h-full">
          <AIChatSidebar apiUrl="http://localhost:5000/api/gemini" />
        </div>

        {/* Right column: Full-height map */}
        <main className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-900 relative">
          <Map routes={routes} vehicle={vehicle} locations={locations} selectedMode={selectedMode} />
          <SelectedModePanel 
            selectedOption={selectedMode} 
            onClose={() => setSelectedMode(null)}
          />
        </main>
      </div>
    </div>
  );
}
export default App;
