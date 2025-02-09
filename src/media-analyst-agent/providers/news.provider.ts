import { Provider, IAgentRuntime, Memory } from '@elizaos/core';
import { elizaLogger } from '@elizaos/core';

interface NewsArticle {
  title: string;
  description: string;
  url: string;
  content: string;
  publishedAt: string;
  source: {
    name: string;
  };
}

interface NewsResponse {
  articles: NewsArticle[];
  totalResults: number;
  status: string;
}

export class NewsProvider implements Provider {
  name = 'NEWS';
  description = 'Provides news articles related to photo locations';

  private async getLocationNews(
    lat: number, 
    lon: number, 
    timestamp: Date,
    radius: number = 50 // Default 50km radius
  ): Promise<NewsArticle[] | null> {
    try {
      const apiKey = process.env.NEWS_API_KEY;
      if (!apiKey) {
        elizaLogger.error('News API key not found in environment variables');
        return null;
      }

      // Convert coordinates to a location query (city name if possible)
      const locationResponse = await fetch(
        `https://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&limit=1&appid=${process.env.OPEN_WEATHER_API_KEY}`
      );
      
      if (!locationResponse.ok) {
        throw new Error('Failed to get location name');
      }

      const locationData = await locationResponse.json();
      const locationQuery = locationData[0]?.name || `${lat},${lon}`;

      // Calculate date range (1 day before and after the photo timestamp)
      const fromDate = new Date(timestamp);
      fromDate.setDate(fromDate.getDate() - 1);
      
      const toDate = new Date(timestamp);
      toDate.setDate(toDate.getDate() + 1);

      elizaLogger.info(`Fetching news for location: ${locationQuery} between ${fromDate.toISOString()} and ${toDate.toISOString()}`);

      // Fetch news articles
      const newsResponse = await fetch(
        `https://newsapi.org/v2/everything?` +
        `q=${encodeURIComponent(locationQuery)}` +
        `&from=${fromDate.toISOString().split('T')[0]}` +
        `&to=${toDate.toISOString().split('T')[0]}` +
        `&sortBy=relevancy` +
        `&language=en` +
        `&pageSize=5` +
        `&apiKey=${apiKey}`,
        {
          headers: {
            'Accept': 'application/json'
          }
        }
      );

      if (!newsResponse.ok) {
        const errorText = await newsResponse.text();
        elizaLogger.error(`News API error: Status ${newsResponse.status}, Response: ${errorText}`);
        throw new Error(`News API error: ${newsResponse.status} - ${errorText}`);
      }

      const data: NewsResponse = await newsResponse.json();
      elizaLogger.info(`Retrieved ${data.articles.length} news articles for location: ${locationQuery}`);
      
      return data.articles;
    } catch (error) {
      elizaLogger.error('Error fetching location-based news:', error);
      return null;
    }
  }

  async get(runtime: IAgentRuntime, message: Memory): Promise<any> {
    const content = message.content as any;
    
    // Check if we have location data and timestamp
    if (!content?.location?.lat || !content?.location?.lng || !content?.timestamp) {
      elizaLogger.info('Missing location or timestamp data for news');
      return null;
    }

    elizaLogger.info('Getting news data for location:', content.location);
    const timestamp = new Date(content.timestamp);
    
    // Get news articles for the location and time
    return this.getLocationNews(
      content.location.lat,
      content.location.lng,
      timestamp
    );
  }

  // Public method to explicitly get news for a location and time
  async getNewsForLocationAndTime(lat: number, lon: number, timestamp: Date): Promise<NewsArticle[] | null> {
    return this.getLocationNews(lat, lon, timestamp);
  }
} 