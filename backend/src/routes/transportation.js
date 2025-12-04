const express = require('express');
const router = express.Router();
const axios = require('axios');

const MAPMYINDIA_KEY = process.env.MAPMYINDIA_API_KEY;
const RAILWAY_API_KEY = process.env.RAILWAY_API_KEY; // From RailwayAPI.com or RapidAPI
const SKYSCANNER_KEY = process.env.SKYSCANNER_API_KEY;

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in km
}

// Estimate crowd level based on time of day
function estimateCrowdLevel() {
  const hour = new Date().getHours();
  // Rush hours: 8-10 AM, 5-8 PM
  if ((hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 20)) {
    return 'crowded';
  } else if (hour >= 22 || hour <= 6) {
    return 'free';
  } else {
    return 'moderate';
  }
}

// Get bus options
async function getBusOptions(origin, destination, distance) {
  try {
    // Base bus fare calculation (India average: ₹2-5 per km for city bus, ₹1-2 per km for intercity)
    const cityBusRate = 3; // ₹ per km
    const intercityBusRate = 1.5; // ₹ per km
    
    // Use city bus for short distances, intercity for longer
    const isIntercity = distance > 50;
    const rate = isIntercity ? intercityBusRate : cityBusRate;
    const cost = Math.round(distance * rate);
    
    // Average bus speed: 30-40 km/h in city, 60-70 km/h on highways
    const avgSpeed = isIntercity ? 65 : 35;
    const time = Math.round((distance / avgSpeed) * 60); // in minutes
    
    return {
      mode: 'bus',
      cost: cost,
      time: time,
      crowdLevel: estimateCrowdLevel(),
      additionalInfo: isIntercity ? 'Intercity bus service' : 'City bus service'
    };
  } catch (error) {
    console.error('Bus options error:', error);
    return null;
  }
}

// Get train options
async function getTrainOptions(origin, destination, distance) {
  try {
    // Train fare calculation (India Railways: ₹0.5-2 per km depending on class)
    // Average: ₹1.2 per km for general class
    const trainRate = 1.2; // ₹ per km
    const cost = Math.round(distance * trainRate);
    
    // Average train speed: 50-60 km/h
    const avgSpeed = 55;
    const time = Math.round((distance / avgSpeed) * 60); // in minutes
    
    // For longer distances, add buffer time for stops
    if (distance > 100) {
      const stops = Math.floor(distance / 50);
      const stopTime = stops * 5; // 5 minutes per stop
      return {
        mode: 'train',
        cost: cost,
        time: time + stopTime,
        crowdLevel: estimateCrowdLevel(),
        additionalInfo: `Indian Railways - ${stops} stops estimated`
      };
    }
    
    return {
      mode: 'train',
      cost: cost,
      time: time,
      crowdLevel: estimateCrowdLevel(),
      additionalInfo: 'Indian Railways'
    };
  } catch (error) {
    console.error('Train options error:', error);
    return null;
  }
}

// Get taxi options
async function getTaxiOptions(origin, destination, distance) {
  try {
    // Taxi fare calculation (India: ₹12-15 per km for standard taxi)
    const taxiRate = 13; // ₹ per km
    const baseFare = 50; // Base fare
    const cost = Math.round(baseFare + (distance * taxiRate));
    
    // Average taxi speed: 40-50 km/h in city
    const avgSpeed = 45;
    const time = Math.round((distance / avgSpeed) * 60); // in minutes
    
    // Try MapmyIndia API if key is available
    if (MAPMYINDIA_KEY) {
      try {
        const mapmyIndiaUrl = `https://apis.mapmyindia.com/advancedmaps/v1/${MAPMYINDIA_KEY}/distance_matrix/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
        const response = await axios.get(mapmyIndiaUrl);
        
        if (response.data && response.data.results && response.data.results.length > 0) {
          const result = response.data.results[0];
          const apiDistance = result.distance / 1000; // Convert to km
          const apiTime = result.duration / 60; // Convert to minutes
          
          return {
            mode: 'taxi',
            cost: Math.round(baseFare + (apiDistance * taxiRate)),
            time: Math.round(apiTime),
            additionalInfo: 'Taxi/Auto rickshaw'
          };
        }
      } catch (apiError) {
        console.warn('MapmyIndia API error, using fallback:', apiError.message);
      }
    }
    
    return {
      mode: 'taxi',
      cost: cost,
      time: time,
      additionalInfo: 'Taxi/Auto rickshaw'
    };
  } catch (error) {
    console.error('Taxi options error:', error);
    return null;
  }
}

// Get flight options (only for long distances)
async function getFlightOptions(origin, destination, distance) {
  try {
    // Only show flights for distances > 300 km
    if (distance < 300) {
      return null;
    }
    
    // Flight fare calculation (India: ₹5-10 per km for domestic flights)
    const flightRate = 7; // ₹ per km
    const baseFare = 2000; // Base fare
    const cost = Math.round(baseFare + (distance * flightRate));
    
    // Flight time: 1 hour for setup + travel time
    // Average flight speed: 800 km/h
    const flightTime = Math.round((distance / 800) * 60);
    const totalTime = 60 + flightTime; // 1 hour for check-in, security, etc.
    
    // Try Skyscanner API if key is available
    if (SKYSCANNER_KEY) {
      try {
        // Note: Skyscanner requires airport codes, not coordinates
        // This is a simplified version - in production, you'd need to map coordinates to airports
        // For now, we'll use the calculated estimate
      } catch (apiError) {
        console.warn('Flight API error, using fallback:', apiError.message);
      }
    }
    
    return {
      mode: 'flight',
      cost: cost,
      time: totalTime,
      additionalInfo: `Domestic flight (${distance.toFixed(0)} km)`
    };
  } catch (error) {
    console.error('Flight options error:', error);
    return null;
  }
}

// Main endpoint to get all transportation options
router.post('/transportation/options', async (req, res) => {
  try {
    const { origin, destination } = req.body;
    
    if (!origin || !destination || !origin.lat || !origin.lng || !destination.lat || !destination.lng) {
      return res.status(400).json({ error: 'Origin and destination with coordinates are required' });
    }
    
    // Calculate distance
    const distance = calculateDistance(
      origin.lat, origin.lng,
      destination.lat, destination.lng
    );
    
    // Get options for all modes in parallel
    const [busOption, trainOption, taxiOption, flightOption] = await Promise.all([
      getBusOptions(origin, destination, distance),
      getTrainOptions(origin, destination, distance),
      getTaxiOptions(origin, destination, distance),
      getFlightOptions(origin, destination, distance)
    ]);
    
    // Filter out null options
    const options = [busOption, trainOption, taxiOption, flightOption].filter(opt => opt !== null);
    
    // Sort by cost (cheapest first)
    options.sort((a, b) => a.cost - b.cost);
    
    res.json({
      success: true,
      options: options,
      distance: distance.toFixed(2)
    });
    
  } catch (error) {
    console.error('Transportation options error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch transportation options',
      message: error.message 
    });
  }
});

module.exports = router;

