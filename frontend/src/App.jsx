import React, { useState, useEffect, useRef } from 'react';
import Map from './components/Map';
import SearchBox from './components/SearchBox';
import { io } from 'socket.io-client';
import AIChatSidebar from './components/AIChatSidebar';

function App(){
  const [routes, setRoutes] = useState([]);
  const [vehicle, setVehicle] = useState(null);
  const [socketStatus, setSocketStatus] = useState('disconnected');
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
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-2 flex gap-4 items-center">
        <h1 className="text-lg font-bold text-slate-800 dark:text-white">Multimodal Transportation</h1>
        <div className="flex-1">
          <SearchBox onRoutes={(r)=> setRoutes(r)} />
        </div>
        <div className="text-xs">
          {socketStatus === 'connected' ? (
            <span className="text-green-600">● Connected</span>
          ) : socketStatus === 'error' ? (
            <span className="text-red-600">● Error</span>
          ) : (
            <span className="text-orange-600">● Disconnected</span>
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
        <main className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-900">
          <Map routes={routes} vehicle={vehicle} />
        </main>
      </div>
    </div>
  );
}
export default App;
