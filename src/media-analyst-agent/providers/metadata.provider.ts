import { Provider, IAgentRuntime, Memory } from '@elizaos/core';
import exifr from 'exifr';

export class MetadataProvider implements Provider {
  name = 'METADATA';
  description = 'Extracts and processes photo metadata';

  async get(runtime: IAgentRuntime, message: Memory): Promise<any> {
    const content = message.content as unknown as { buffer: Buffer };
    if (!content?.buffer) {
      throw new Error('Photo buffer is required');
    }
    return this.extractMetadata(content.buffer);
  }

  private async extractMetadata(buffer: Buffer): Promise<any> {
    try {
      const metadata = await exifr.parse(buffer, {
        // Include all available metadata
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

      return {
        ...metadata,
        extractedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Error extracting metadata:', error);
      throw error;
    }
  }

  private async validateMetadata(metadata: any): Promise<{
    isValid: boolean;
    issues?: string[];
  }> {
    const issues: string[] = [];

    // Check for required fields
    if (!metadata.DateTimeOriginal) {
      issues.push('Missing original timestamp');
    }

    // Check for location data
    if (!metadata.latitude || !metadata.longitude) {
      issues.push('Missing GPS coordinates');
    }

    // Check for camera information
    if (!metadata.Make || !metadata.Model) {
      issues.push('Missing camera information');
    }

    return {
      isValid: issues.length === 0,
      issues: issues.length > 0 ? issues : undefined,
    };
  }
} 