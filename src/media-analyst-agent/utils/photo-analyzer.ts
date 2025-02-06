import { MediaAnalystAgent } from '../agent.js';
import fs from 'fs/promises';
import path from 'path';
import { elizaLogger } from '@elizaos/core';
import heicConvert from 'heic-convert';
import exifr from 'exifr';

export class PhotoAnalyzer {
  constructor(private agent: MediaAnalystAgent) {}

  private async extractMetadata(buffer: Buffer, filePath: string) {
    try {
      const metadata = await exifr.parse(buffer, {
        tiff: true,
        exif: true,
        gps: true,
        icc: true,
        iptc: true,
        xmp: true,
        interop: true,
        translateValues: true,
        translateKeys: true,
        reviveValues: true,
      });

      if (!metadata) return {};

      // Convert GPS coordinates to standard format if available
      const location = metadata.latitude && metadata.longitude
        ? { lat: metadata.latitude, lng: metadata.longitude }
        : undefined;

      // Extract all available metadata fields
      const extractedMetadata = {
        // Basic info
        Make: metadata.Make || metadata.DeviceMake,
        Model: metadata.Model || metadata.DeviceModel,
        ImageWidth: metadata.ImageWidth || metadata.ExifImageWidth,
        ImageHeight: metadata.ImageHeight || metadata.ExifImageHeight,
        
        // Timestamps
        DateTimeOriginal: metadata.DateTimeOriginal || metadata.CreateDate,
        CreateDate: metadata.CreateDate,
        ModifyDate: metadata.ModifyDate,
        
        // Camera settings
        FNumber: metadata.FNumber,
        ApertureValue: metadata.ApertureValue,
        FocalLength: metadata.FocalLength,
        ISO: metadata.ISO,
        ExposureTime: metadata.ExposureTime,
        Flash: metadata.Flash,
        
        // Location
        latitude: metadata.latitude,
        longitude: metadata.longitude,
        
        // Include all other metadata
        ...metadata
      };

      return extractedMetadata;
    } catch (error) {
      elizaLogger.error('Error extracting metadata:', error);
      return {};
    }
  }

  private async convertHeicToBuffer(heicBuffer: Buffer): Promise<Buffer> {
    try {
      const jpegBuffer = await heicConvert({
        buffer: heicBuffer,
        format: 'JPEG',
        quality: 1
      });
      return jpegBuffer;
    } catch (error) {
      elizaLogger.error('Error converting HEIC:', error);
      throw error;
    }
  }

  /**
   * Analyze a photo from a local file path
   */
  async analyzeFromFile(filePath: string) {
    try {
      const buffer = await fs.readFile(filePath);
      const originalMetadata = await this.extractMetadata(buffer, filePath);
      
      // Convert HEIC to JPEG if needed
      const processedBuffer = path.extname(filePath).toLowerCase() === '.heic' 
        ? await this.convertHeicToBuffer(buffer)
        : buffer;
      
      const result = await this.agent.analyzePhoto({
        buffer: processedBuffer,
        metadata: originalMetadata,
        timestamp: originalMetadata.DateTimeOriginal || new Date(),
        location: originalMetadata.location
      });

      elizaLogger.info('Analysis result:', result);
      return result;
    } catch (error) {
      elizaLogger.error('Error analyzing photo:', error);
      throw error;
    }
  }

  /**
   * Analyze multiple photos from a directory
   */
  async analyzeDirectory(dirPath: string, fileExtensions = ['.jpg', '.jpeg', '.png', '.heic']) {
    try {
      const files = await fs.readdir(dirPath);
      const results = [];

      for (const file of files) {
        if (fileExtensions.some(ext => file.toLowerCase().endsWith(ext))) {
          elizaLogger.info('Analyzing:', file);
          const result = await this.analyzeFromFile(path.join(dirPath, file));
          results.push({ file, result });
        }
      }

      return results;
    } catch (error) {
      elizaLogger.error('Error analyzing directory:', error);
      throw error;
    }
  }

  /**
   * Analyze a photo from a Buffer (useful for cloud storage or streams)
   */
  async analyzeFromBuffer(buffer: Buffer, metadata?: any) {
    try {
      const extractedMetadata = await this.extractMetadata(buffer, '');
      const result = await this.agent.analyzePhoto({
        buffer,
        metadata: { ...extractedMetadata, ...metadata },
        timestamp: extractedMetadata.DateTimeOriginal || new Date(),
        location: extractedMetadata.location
      });

      elizaLogger.info('Analysis result:', result);
      return result;
    } catch (error) {
      elizaLogger.error('Error analyzing photo buffer:', error);
      throw error;
    }
  }
}

// Example usage:
/*
const agent = new MediaAnalystAgent({...}); // Your agent configuration
const analyzer = new PhotoAnalyzer(agent);

// Analyze a single photo
await analyzer.analyzeFromFile('./photos/sample.jpg');

// Analyze all photos in a directory
await analyzer.analyzeDirectory('./photos');

// Analyze from buffer (e.g., from cloud storage)
const buffer = await downloadFromCloud('photo-id');
await analyzer.analyzeFromBuffer(buffer);
*/ 