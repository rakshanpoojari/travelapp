const express = require('express');
const router = express.Router();
const axios = require('axios');

const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;
// OpenRouteService API key - get free key from https://openrouteservice.org/dev/#/signup
// For testing, you can use the demo key, but it has rate limits
const OPENROUTESERVICE_KEY = process.env.OPENROUTESERVICE_API_KEY;

// Map Google mode to OpenRouteService profile
function mapModeToProfile(mode) {
  const modeMap = {
    'driving': 'driving-car',
    'walking': 'foot-walking',
    'bicycling': 'cycling-regular',
    'transit': 'driving-car' // OpenRouteService doesn't support transit, fallback to driving
  };
  return modeMap[mode] || 'driving-car';
}

// Convert OpenRouteService response to Google Directions format for compatibility
function convertORSResponse(orsData, origin, destination) {
  if (!orsData || !orsData.features || orsData.features.length === 0) {
    return {
      status: 'ZERO_RESULTS',
      routes: []
    };
  }

  const routes = orsData.features.map((feature, idx) => {
    const geometry = feature.geometry;
    const coordinates = geometry.coordinates; // [lng, lat] format
    const properties = feature.properties;
    
    // Convert coordinates to [lat, lng] format and create overview_path
    const overview_path = coordinates.map(coord => ({
      lat: coord[1],
      lng: coord[0]
    }));

    // Calculate distance and duration
    const distance = properties.segments ? 
      properties.segments.reduce((sum, seg) => sum + (seg.distance || 0), 0) : 
      (properties.summary?.distance || 0);
    const duration = properties.segments ? 
      properties.segments.reduce((sum, seg) => sum + (seg.duration || 0), 0) : 
      (properties.summary?.duration || 0);

    return {
      overview_polyline: {
        points: '' // We'll use overview_path instead
      },
      overview_path: overview_path,
      bounds: {
        northeast: {
          lat: Math.max(...coordinates.map(c => c[1])),
          lng: Math.max(...coordinates.map(c => c[0]))
        },
        southwest: {
          lat: Math.min(...coordinates.map(c => c[1])),
          lng: Math.min(...coordinates.map(c => c[0]))
        }
      },
      legs: [{
        distance: { value: Math.round(distance), text: `${(distance / 1000).toFixed(1)} km` },
        duration: { value: Math.round(duration), text: `${Math.round(duration / 60)} mins` },
        steps: []
      }],
      summary: `${(distance / 1000).toFixed(1)} km, ${Math.round(duration / 60)} mins`
    };
  });

  return {
    status: 'OK',
    routes: routes
  };
}

// Directions endpoint - uses OpenRouteService (free) with fallback to Google if key is provided
router.get('/directions', async (req, res) => {
  const { origin, destination, mode } = req.query;

  try {
    
    if (!origin || !destination) {
      return res.status(400).json({ error: 'origin and destination are required' });
    }

    // Parse coordinates if provided as "lat,lng"
    let originCoords, destCoords;
    try {
      const [originLat, originLng] = origin.split(',').map(parseFloat);
      const [destLat, destLng] = destination.split(',').map(parseFloat);
      
      if (isNaN(originLat) || isNaN(originLng) || isNaN(destLat) || isNaN(destLng)) {
        throw new Error('Invalid coordinates');
      }
      
      originCoords = [originLng, originLat]; // OpenRouteService uses [lng, lat]
      destCoords = [destLng, destLat];
    } catch (e) {
      return res.status(400).json({ error: 'Invalid coordinate format. Use "lat,lng"' });
    }

    const profile = mapModeToProfile(mode || 'driving');
    
    // Use OpenRouteService (free, no billing required)
    // If no API key, use OSRM as fallback (completely free, no key needed)
    if (OPENROUTESERVICE_KEY) {
      const orsUrl = `https://api.openrouteservice.org/v2/directions/${profile}`;
      
      const orsResponse = await axios.post(orsUrl, {
        coordinates: [originCoords, destCoords],
        format: 'geojson'
      }, {
        headers: {
          'Authorization': OPENROUTESERVICE_KEY.startsWith('Bearer ') ? OPENROUTESERVICE_KEY : `Bearer ${OPENROUTESERVICE_KEY}`,
          'Content-Type': 'application/json'
        }
      });

      // Convert to Google Directions format for frontend compatibility
      const convertedResponse = convertORSResponse(orsResponse.data, origin, destination);
      return res.json(convertedResponse);
    } else {
      // Fallback to OSRM (Open Source Routing Machine) - completely free, no API key needed
      // Map profile to OSRM service names
      const osrmProfileMap = {
        'driving-car': 'driving',
        'foot-walking': 'walking',
        'cycling-regular': 'cycling'
      };
      const osrmProfile = osrmProfileMap[profile] || 'driving';
      const osrmUrl = `https://routing.openstreetmap.de/routed-${osrmProfile}/route/v1/${osrmProfile}/${originCoords[0]},${originCoords[1]};${destCoords[0]},${destCoords[1]}?overview=full&geometries=geojson`;
      
      try {
        const osrmResponse = await axios.get(osrmUrl, { timeout: 30000 });
        
        if (osrmResponse.data.code === 'Ok' && osrmResponse.data.routes && osrmResponse.data.routes.length > 0) {
          const osrmRoute = osrmResponse.data.routes[0];
          const geometry = osrmRoute.geometry;
          
          // Convert OSRM response to Google Directions format
          const overview_path = geometry.coordinates.map(coord => ({
            lat: coord[1], // OSRM uses [lng, lat]
            lng: coord[0]
          }));
          
          const convertedResponse = {
            status: 'OK',
            routes: [{
              overview_path: overview_path,
              bounds: {
                northeast: {
                  lat: Math.max(...geometry.coordinates.map(c => c[1])),
                  lng: Math.max(...geometry.coordinates.map(c => c[0]))
                },
                southwest: {
                  lat: Math.min(...geometry.coordinates.map(c => c[1])),
                  lng: Math.min(...geometry.coordinates.map(c => c[0]))
                }
              },
              legs: [{
                distance: { value: Math.round(osrmRoute.distance), text: `${(osrmRoute.distance / 1000).toFixed(1)} km` },
                duration: { value: Math.round(osrmRoute.duration), text: `${Math.round(osrmRoute.duration / 60)} mins` },
                steps: []
              }],
              summary: `${(osrmRoute.distance / 1000).toFixed(1)} km, ${Math.round(osrmRoute.duration / 60)} mins`
            }]
          };
          
          return res.json(convertedResponse);
        } else {
          return res.status(404).json({ status: 'ZERO_RESULTS', routes: [] });
        }
      } catch (osrmErr) {
        console.error('OSRM error:', osrmErr.message);
        // Continue to error handler below
        throw osrmErr;
      }
    }

  } catch (err) {
    console.error('Directions error:', err.response?.data || err.message);

    // If OpenRouteService fails and Google key exists, try Google as fallback
    if (GOOGLE_KEY && !err.response) {
      try {
        const googleUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&mode=${mode || 'driving'}&key=${GOOGLE_KEY}&alternatives=true`;
        const googleResponse = await axios.get(googleUrl);
        return res.json(googleResponse.data);
      } catch (googleErr) {
        console.error('Google fallback also failed:', googleErr.message);
      }
    }

    // Return a valid response even on error to prevent 500
    res.status(200).json({
      status: 'ZERO_RESULTS',
      routes: [],
      error: 'directions error',
      message: err.response?.data?.error?.message || err.message
    });
  }
});

// Save/Load favorite routes (pseudo)
const Route = require('../models/Route');
router.post('/routes', async (req,res) => {
  const doc = new Route(req.body);
  await doc.save();
  res.json(doc);
});
router.get('/routes', async (req,res) => {
  const list = await Route.find().sort({createdAt:-1}).limit(50);
  res.json(list);
});

module.exports = router;
