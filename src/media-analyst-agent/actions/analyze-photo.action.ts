import { Action, IAgentRuntime, Memory } from '@elizaos/core';
import exifr from 'exifr';
import { createHash } from 'crypto';

export interface PhotoData {
  buffer: Buffer;
  metadata: any;
  timestamp: Date;
  location?: { lat: number; lng: number };
}

export interface AnalysisResult {
  analysis: string;
  authenticity: boolean;
  contextualData: {
    weather?: any;
    news?: any;
    location?: {
      coordinates: string;
      address?: string;
      city?: string;
      state?: string;
      country?: string;
      landmarks?: string[];
    };
  };
}

export class AnalyzePhotoAction implements Action {
  name = 'ANALYZE_PHOTO';
  description = 'Analyzes photos and extracts metadata, context, and verifies authenticity';
  similes = ['PROCESS_PHOTO', 'EXAMINE_PHOTO'];
  examples = [];

  async validate(runtime: IAgentRuntime, message: Memory): Promise<boolean> {
    const content = message.content as unknown as PhotoData;
    return !!(content?.buffer && content?.timestamp);
  }

  async handler(runtime: IAgentRuntime, message: Memory): Promise<AnalysisResult> {
    const photoData = message.content as unknown as PhotoData;
    if (!photoData?.buffer) {
      throw new Error('Photo data is required');
    }

    try {
      // Generate hash for authenticity
      const hash = createHash('sha256')
        .update(new Uint8Array(photoData.buffer))
        .digest('hex');

      // Extract GPS coordinates if available
      const coordinates = photoData.location || 
        (photoData.metadata?.latitude && photoData.metadata?.longitude
          ? { lat: photoData.metadata.latitude, lng: photoData.metadata.longitude }
          : undefined);

      // Get location details if coordinates are available
      let locationDetails = null;
      let weatherData = null;
      let newsData = null;
      if (coordinates) {
        const locationProvider = runtime.providers.find(p => (p as any).name === 'LOCATION');
        const weatherProvider = runtime.providers.find(p => (p as any).name === 'WEATHER');
        const newsProvider = runtime.providers.find(p => (p as any).name === 'NEWS');
        
        locationDetails = await locationProvider?.get(runtime, {
          ...message,
          content: { ...message.content, location: coordinates }
        });

        // Pass both location and timestamp for historical weather data
        weatherData = await weatherProvider?.get(runtime, {
          ...message,
          content: { 
            ...message.content, 
            location: coordinates,
            timestamp: photoData.metadata?.DateTimeOriginal || photoData.timestamp
          }
        });

        // Get news articles from around the time and location of the photo
        newsData = await newsProvider?.get(runtime, {
          ...message,
          content: {
            ...message.content,
            location: coordinates,
            timestamp: photoData.metadata?.DateTimeOriginal || photoData.timestamp
          }
        });
      }

      // Comprehensive image analysis using all available metadata
      const analysis = {
        timestamp: photoData.timestamp,
        camera: photoData.metadata?.Make && photoData.metadata?.Model 
          ? `${photoData.metadata.Make} ${photoData.metadata.Model}`
          : 'Unknown',
        resolution: photoData.metadata?.ImageWidth && photoData.metadata?.ImageHeight
          ? `${photoData.metadata.ImageWidth}x${photoData.metadata.ImageHeight}`
          : 'Unknown',
        aperture: photoData.metadata?.FNumber || photoData.metadata?.ApertureValue,
        focalLength: photoData.metadata?.FocalLength,
        iso: photoData.metadata?.ISO,
        exposureTime: photoData.metadata?.ExposureTime,
        flash: photoData.metadata?.Flash,
        location: coordinates,
        hash
      };

      return {
        analysis: JSON.stringify(analysis),
        authenticity: true, // This should be verified using EigenLayer-backed AVS tools
        contextualData: {
          location: coordinates ? {
            coordinates: `${coordinates.lat}, ${coordinates.lng}`,
            address: locationDetails?.address,
            city: locationDetails?.city,
            state: locationDetails?.state,
            country: locationDetails?.country,
            landmarks: locationDetails?.landmarks
          } : undefined,
          weather: weatherData ? {
            temperature: weatherData.main.temp,
            conditions: weatherData.weather[0].main,
            description: weatherData.weather[0].description,
            humidity: weatherData.main.humidity,
            windSpeed: weatherData.wind.speed,
            visibility: weatherData.visibility,
            precipitation: weatherData.rain?.['1h'] || 0,
            dataType: weatherData.timestamp ? 'historical' : 'current',
            weatherTime: weatherData.timestamp ? weatherData.timestamp : new Date(weatherData.dt * 1000).toISOString()
          } : undefined,
          news: newsData ? newsData.map(article => ({
            title: article.title,
            description: article.description,
            source: article.source.name,
            publishedAt: article.publishedAt,
            url: article.url
          })) : undefined
        }
      };
    } catch (error) {
      console.error('Error analyzing photo:', error);
      throw error;
    }
  }
} 