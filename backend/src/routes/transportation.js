const express = require('express');
const router = express.Router();
const axios = require('axios');

const MAPMYINDIA_KEY = process.env.MAPMYINDIA_API_KEY;
const RAILWAY_API_KEY = process.env.RAILWAY_API_KEY; // From RailwayAPI.com or RapidAPI
const SKYSCANNER_KEY = process.env.SKYSCANNER_API_KEY;

// Mock bus route graph for Karnataka (India) - in production, this would come from GTFS data
const BUS_ROUTE_GRAPH = {
  // Major cities and their direct bus connections
  "Bengaluru": ["Nelamangala", "Kunigal", "Hassan", "Mysuru", "Tumkur"],
  "Nelamangala": ["Bengaluru", "Kunigal"],
  "Kunigal": ["Nelamangala", "Bengaluru", "Hassan"],
  "Hassan": ["Kunigal", "Bengaluru", "Sakleshpur", "Mangalore"],
  "Sakleshpur": ["Hassan", "Uppinangady"],
  "Uppinangady": ["Sakleshpur", "Mangalore"],
  "Mangalore": ["Uppinangady", "Hassan", "Udupi", "Puttur"],
  "Mysuru": ["Bengaluru", "Mandya"],
  "Mandya": ["Mysuru", "Bengaluru"],
  "Tumkur": ["Bengaluru", "Chitradurga"],
  "Chitradurga": ["Tumkur", "Davangere"],
  "Davangere": ["Chitradurga", "Hubli"],
  "Hubli": ["Davangere", "Belgaum"],
  "Belgaum": ["Hubli", "Pune"],
  "Udupi": ["Mangalore", "Manipal"],
  "Sulya": ["Puttur"],
  "Puttur": ["Sulya", "Mangalore", "Uppinangady"]
};

// Mock fare chart (₹ per km) - in production, this would come from fare_rules.txt
const BUS_FARE_CHART = {
  "Bengaluru-Nelamangala": 40,
  "Nelamangala-Kunigal": 50,
  "Kunigal-Hassan": 80,
  "Hassan-Sakleshpur": 60,
  "Sakleshpur-Uppinangady": 80,
  "Uppinangady-Mangalore": 100,
  "Bengaluru-Mysuru": 120,
  "Mysuru-Mandya": 40,
  "Bengaluru-Tumkur": 60,
  "Tumkur-Chitradurga": 70,
  "Chitradurga-Davangere": 80,
  "Davangere-Hubli": 90,
  "Hubli-Belgaum": 100,
  "Mangalore-Udupi": 50,
  "Sulya-Puttur": 45,
  "Puttur-Mangalore": 55,
  "Puttur-Uppinangady": 35
};

// Bus service details
const BUS_SERVICES = {
  "Bengaluru-Nelamangala": { name: "KSRTC 101", operator: "KSRTC" },
  "Nelamangala-Kunigal": { name: "KSRTC 102", operator: "KSRTC" },
  "Kunigal-Hassan": { name: "KSRTC 121", operator: "KSRTC" },
  "Hassan-Sakleshpur": { name: "KSRTC 88", operator: "KSRTC" },
  "Sakleshpur-Uppinangady": { name: "Private 33", operator: "Private" },
  "Uppinangady-Mangalore": { name: "KSRTC 42", operator: "KSRTC" },
  "Bengaluru-Mysuru": { name: "KSRTC 201", operator: "KSRTC" },
  "Mysuru-Mandya": { name: "KSRTC 202", operator: "KSRTC" },
  "Bengaluru-Tumkur": { name: "KSRTC 301", operator: "KSRTC" },
  "Tumkur-Chitradurga": { name: "KSRTC 302", operator: "KSRTC" },
  "Chitradurga-Davangere": { name: "KSRTC 303", operator: "KSRTC" },
  "Davangere-Hubli": { name: "KSRTC 304", operator: "KSRTC" },
  "Hubli-Belgaum": { name: "KSRTC 305", operator: "KSRTC" },
  "Mangalore-Udupi": { name: "KSRTC 401", operator: "KSRTC" },
  "Sulya-Puttur": { name: "KSRTC 501", operator: "KSRTC" },
  "Puttur-Mangalore": { name: "KSRTC 502", operator: "KSRTC Express" },
  "Puttur-Uppinangady": { name: "Private 55", operator: "Private" }
};

// Calculate distance between two points (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

// Find bus route using BFS (Breadth-First Search)
function findBusRoute(originCity, destinationCity) {
  if (!BUS_ROUTE_GRAPH[originCity] || !BUS_ROUTE_GRAPH[destinationCity]) {
    return null; // No route data available
  }

  if (originCity === destinationCity) {
    return [originCity]; // Same city
  }

  const queue = [[originCity]];
  const visited = new Set([originCity]);

  while (queue.length > 0) {
    const currentPath = queue.shift();
    const currentCity = currentPath[currentPath.length - 1];

    if (currentCity === destinationCity) {
      return currentPath;
    }

    const neighbors = BUS_ROUTE_GRAPH[currentCity] || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push([...currentPath, neighbor]);
      }
    }
  }

  return null; // No route found
}

// Calculate fare for a specific segment
function calculateSegmentFare(fromCity, toCity) {
  const key = `${fromCity}-${toCity}`;
  const reverseKey = `${toCity}-${fromCity}`;

  // Check both directions
  return BUS_FARE_CHART[key] || BUS_FARE_CHART[reverseKey] || 50; // Default fare
}

// Get bus service details for a segment
function getBusService(fromCity, toCity) {
  const key = `${fromCity}-${toCity}`;
  const reverseKey = `${toCity}-${fromCity}`;

  return BUS_SERVICES[key] || BUS_SERVICES[reverseKey] || {
    name: "Local Bus",
    operator: "Private"
  };
}

// Estimate time for a segment (mock calculation)
function estimateSegmentTime(fromCity, toCity) {
  // Mock distance-based time calculation (30-60 km/h average speed)
  const mockDistances = {
    "Bengaluru-Nelamangala": 25,
    "Nelamangala-Kunigal": 35,
    "Kunigal-Hassan": 45,
    "Hassan-Sakleshpur": 30,
    "Sakleshpur-Uppinangady": 40,
    "Uppinangady-Mangalore": 50,
    "Bengaluru-Mysuru": 140,
    "Mysuru-Mandya": 45,
    "Bengaluru-Tumkur": 70,
    "Tumkur-Chitradurga": 80,
    "Chitradurga-Davangere": 90,
    "Davangere-Hubli": 100,
    "Hubli-Belgaum": 110,
    "Mangalore-Udupi": 60,
    "Sulya-Puttur": 45,
    "Puttur-Mangalore": 52
  };

  const key = `${fromCity}-${toCity}`;
  const reverseKey = `${toCity}-${fromCity}`;
  const distance = mockDistances[key] || mockDistances[reverseKey] || 50;

  // Average bus speed: 45 km/h
  const avgSpeed = 45;
  return Math.round((distance / avgSpeed) * 60); // in minutes
}

// Get multi-segment bus options
async function getMultiSegmentBusOptions(originCity, destinationCity) {
  try {
    const route = findBusRoute(originCity, destinationCity);

    if (route) {
      console.log(`[BusRoute] Found path for ${originCity}->${destinationCity}:`, route);
    }

    if (!route || route.length < 2) {
      return null; // No route found or direct route
    }

    // Create segments
    const segments = [];
    let totalFare = 0;
    let totalTime = 0;

    for (let i = 0; i < route.length - 1; i++) {
      const fromCity = route[i];
      const toCity = route[i + 1];
      const fare = calculateSegmentFare(fromCity, toCity);
      const time = estimateSegmentTime(fromCity, toCity);
      const service = getBusService(fromCity, toCity);

      segments.push({
        from: fromCity,
        to: toCity,
        fare: fare,
        time: time,
        bus: service.name,
        operator: service.operator,
        crowdLevel: estimateCrowdLevel()
      });

      totalFare += fare;
      totalTime += time;
    }

    // Add layover time between segments (30 minutes per change)
    const layoverTime = (segments.length - 1) * 30;
    totalTime += layoverTime;

    return {
      mode: 'bus',
      type: 'multi-segment',
      segments: segments,
      totalFare: totalFare,
      totalTime: totalTime,
      numberOfChanges: segments.length - 1,
      crowdLevel: estimateCrowdLevel(), // Overall crowd level
      additionalInfo: `${segments.length - 1} bus change(s) required`
    };

  } catch (error) {
    console.error('Multi-segment bus options error:', error);
    return null;
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

    // Extract city names from labels (simplified - in production, use geocoding reverse lookup)
    const extractCityName = (location) => {
      if (!location || !location.label) return null;
      // Simple extraction - in production, use proper geocoding
      const label = location.label.toLowerCase();
      const cities = Object.keys(BUS_ROUTE_GRAPH);

      for (const city of cities) {
        if (label.includes(city.toLowerCase())) {
          return city;
        }
      }
      return null;
    };

    const originCity = extractCityName(origin);
    const destinationCity = extractCityName(destination);

    // Get options for all modes in parallel
    const [busOption, trainOption, taxiOption, flightOption, multiSegmentBusOption] = await Promise.all([
      getBusOptions(origin, destination, distance),
      getTrainOptions(origin, destination, distance),
      getTaxiOptions(origin, destination, distance),
      getFlightOptions(origin, destination, distance),
      originCity && destinationCity ? getMultiSegmentBusOptions(originCity, destinationCity) : Promise.resolve(null)
    ]);

    // Filter out null options
    const options = [busOption, trainOption, taxiOption, flightOption, multiSegmentBusOption].filter(opt => opt !== null);

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

