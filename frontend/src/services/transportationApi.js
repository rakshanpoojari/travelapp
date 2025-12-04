import API from './api';

/**
 * Get transportation options for a route
 * @param {Object} origin - { lat, lng, label }
 * @param {Object} destination - { lat, lng, label }
 * @returns {Promise<Array>} Array of transportation options
 */
export async function getTransportationOptions(origin, destination) {
  try {
    // Handle both 'lon' (from Nominatim) and 'lng' (standard) property names
    const originLng = origin.lng || origin.lon;
    const destLng = destination.lng || destination.lon;
    
    if (!origin.lat || !originLng || !destination.lat || !destLng) {
      console.error('Missing coordinates:', { origin, destination });
      return [];
    }
    
    const response = await API.post('/transportation/options', {
      origin: {
        lat: origin.lat,
        lng: originLng,
        label: origin.label
      },
      destination: {
        lat: destination.lat,
        lng: destLng,
        label: destination.label
      }
    });
    return response.data.options || [];
  } catch (error) {
    console.error('Error fetching transportation options:', error);
    return [];
  }
}

