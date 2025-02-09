import { Provider, IAgentRuntime, Memory } from '@elizaos/core';
import { elizaLogger } from '@elizaos/core';

interface WeatherData {
  main: {
    temp: number;
    feels_like: number;
    temp_min: number;
    temp_max: number;
    pressure: number;
    humidity: number;
  };
  weather: Array<{
    id: number;
    main: string;
    description: string;
    icon: string;
  }>;
  wind: {
    speed: number;
    deg: number;
    gust?: number;
  };
  clouds: {
    all: number;
  };
  rain?: {
    '1h'?: number;
    '3h'?: number;
  };
  visibility: number;
  dt: number;
  timestamp?: Date; // Adding timestamp for historical data
}

export class WeatherProvider implements Provider {
  name = 'WEATHER';
  description = 'Provides weather information for photo locations';

  private async getCurrentWeather(lat: number, lon: number): Promise<WeatherData | null> {
    try {
      const apiKey = process.env.OPEN_WEATHER_API_KEY;
      if (!apiKey) {
        elizaLogger.error('OpenWeather API key not found in environment variables');
        return null;
      }

      elizaLogger.info(`Fetching current weather data for coordinates: ${lat}, ${lon}`);
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.statusText}`);
      }

      const data = await response.json();
      elizaLogger.info('Current weather data retrieved:', data);
      return data;
    } catch (error) {
      elizaLogger.error('Error fetching current weather data:', error);
      return null;
    }
  }

  private async getHistoricalWeather(lat: number, lon: number, timestamp: number): Promise<WeatherData | null> {
    try {
      const apiKey = process.env.OPEN_WEATHER_API_KEY;
      if (!apiKey) {
        elizaLogger.error('OpenWeather API key not found in environment variables');
        return null;
      }

      elizaLogger.info(`Fetching historical weather data for coordinates: ${lat}, ${lon} at timestamp: ${timestamp}`);
      const response = await fetch(
        `https://history.openweathermap.org/data/2.5/history/city?lat=${lat}&lon=${lon}&type=hour&start=${timestamp}&cnt=1&appid=${apiKey}&units=metric`,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        elizaLogger.error(`Historical weather API error: Status ${response.status}, Response: ${errorText}`);
        
        // If we get a subscription error, fall back to current weather
        if (response.status === 401 || response.status === 403) {
          elizaLogger.info('Falling back to current weather data due to API access restrictions. Note: Historical weather data requires a paid subscription to OpenWeatherMap History API.');
          return this.getCurrentWeather(lat, lon);
        }
        
        throw new Error(`Weather API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      elizaLogger.info('Historical weather data retrieved:', data);
      
      // Transform historical data to match our WeatherData interface
      // The history API returns data in a different format with the 'list' array
      const historicalData = data.list?.[0] || data;
      return {
        main: {
          temp: historicalData.main?.temp,
          feels_like: historicalData.main?.feels_like,
          temp_min: historicalData.main?.temp_min,
          temp_max: historicalData.main?.temp_max,
          pressure: historicalData.main?.pressure,
          humidity: historicalData.main?.humidity
        },
        weather: historicalData.weather,
        wind: {
          speed: historicalData.wind?.speed,
          deg: historicalData.wind?.deg,
          gust: historicalData.wind?.gust
        },
        clouds: {
          all: historicalData.clouds?.all || historicalData.clouds
        },
        rain: historicalData.rain,
        visibility: historicalData.visibility,
        dt: historicalData.dt,
        timestamp: new Date(historicalData.dt * 1000)
      };
    } catch (error) {
      elizaLogger.error('Error fetching historical weather data:', error);
      
      // Fall back to current weather if historical data fails
      elizaLogger.info('Falling back to current weather data');
      return this.getCurrentWeather(lat, lon);
    }
  }

  async get(runtime: IAgentRuntime, message: Memory): Promise<any> {
    const content = message.content as any;
    
    // Check if we have location data
    if (!content?.location?.lat || !content?.location?.lng) {
      elizaLogger.info('No location data available for weather');
      return null;
    }

    elizaLogger.info('Getting weather data for location:', content.location);

    // If we have a timestamp, try to get historical weather
    if (content.timestamp) {
      const timestamp = new Date(content.timestamp);
      const unixTimestamp = Math.floor(timestamp.getTime() / 1000);
      return this.getHistoricalWeather(content.location.lat, content.location.lng, unixTimestamp);
    }

    // Otherwise get current weather
    return this.getCurrentWeather(content.location.lat, content.location.lng);
  }

  // Remove the mock implementations and use the real API methods
  async getCurrentWeatherData(lat: number, lon: number): Promise<WeatherData | null> {
    return this.getCurrentWeather(lat, lon);
  }

  async getHistoricalWeatherData(lat: number, lon: number, timestamp: Date): Promise<WeatherData | null> {
    const unixTimestamp = Math.floor(timestamp.getTime() / 1000);
    return this.getHistoricalWeather(lat, lon, unixTimestamp);
  }
} 