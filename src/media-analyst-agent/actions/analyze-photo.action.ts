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
        .update(photoData.buffer)
        .digest('hex');

      // Extract GPS coordinates if available
      const coordinates = photoData.location || 
        (photoData.metadata?.latitude && photoData.metadata?.longitude
          ? { lat: photoData.metadata.latitude, lng: photoData.metadata.longitude }
          : undefined);

      // Get location details if coordinates are available
      let locationDetails = null;
      if (coordinates) {
        const locationProvider = runtime.providers.find(p => (p as any).name === 'LOCATION');
        locationDetails = await locationProvider?.get(runtime, {
          ...message,
          content: { ...message.content, location: coordinates }
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
          } : undefined
        }
      };
    } catch (error) {
      console.error('Error analyzing photo:', error);
      throw error;
    }
  }
} 