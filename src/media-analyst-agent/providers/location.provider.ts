import { Provider, IAgentRuntime, Memory } from '@elizaos/core';
import { elizaLogger } from '@elizaos/core';

interface LocationDetails {
  address: string;
  city?: string;
  state?: string;
  country?: string;
  postcode?: string;
  landmarks?: string[];
  displayName: string;
}

export class LocationProvider implements Provider {
  name = 'LOCATION';
  description = 'Provides location information from photo metadata';

  private async reverseGeocode(lat: number, lon: number): Promise<LocationDetails> {
    try {
      // Using OpenStreetMap Nominatim API
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&namedetails=1`,
        {
          headers: {
            'User-Agent': 'MediaAnalystAgent/1.0',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Extract nearby landmarks if available
      const landmarks = [];
      if (data.namedetails) {
        if (data.namedetails.name) landmarks.push(data.namedetails.name);
        if (data.namedetails.alt_name) landmarks.push(data.namedetails.alt_name);
      }

      return {
        address: data.address?.road || data.address?.suburb || '',
        city: data.address?.city || data.address?.town || data.address?.village,
        state: data.address?.state,
        country: data.address?.country,
        postcode: data.address?.postcode,
        landmarks,
        displayName: data.display_name
      };
    } catch (error) {
      console.error('Error in reverse geocoding:', error);
      return {
        address: 'Unknown',
        displayName: 'Location details unavailable'
      };
    }
  }

  async get(runtime: IAgentRuntime, message: Memory): Promise<any> {
    const content = message.content as any;
    
    // Check if we have location data
    if (!content?.location?.lat || !content?.location?.lng) {
      elizaLogger.info('No location data available');
      return null;
    }

    elizaLogger.info('Getting location details for coordinates:', content.location);
    
    // Get location details from OpenStreetMap
    return this.reverseGeocode(content.location.lat, content.location.lng);
  }
} 