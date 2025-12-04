import React, { useState, useEffect, useRef } from 'react';
import Map from './components/Map';
import SearchBox from './components/SearchBox';
import { io } from 'socket.io-client';
import MapComponent from './components/MapComponent';
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
    <div>
      <AIChatSidebar apiUrl="http://localhost:5000/api/deepseek" />
      <SearchBox onRoutes={(r)=> setRoutes(r)} />
      {socketStatus === 'disconnected' && (
        <div style={{ color: 'orange', padding: 8 }}>
          Not connected to realtime server. Start the backend at <code>http://localhost:5000</code> to enable live updates.
        </div>
      )}
      {socketStatus === 'error' && (
        <div style={{ color: 'red', padding: 8 }}>
          Unable to connect to realtime server (connection refused). Ensure backend is running and CORS/socket endpoint is reachable.
        </div>
      )}
      <Map routes={routes} vehicle={vehicle} />
       <h1 className="text-center text-3xl font-bold p-4">Multimodal Transportation App</h1>
      <MapComponent />
    </div>
  );
}
export default App;
