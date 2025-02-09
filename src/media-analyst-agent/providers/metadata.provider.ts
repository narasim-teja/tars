import { Provider, IAgentRuntime, Memory } from '@elizaos/core';
import exifr from 'exifr';

export class MetadataProvider implements Provider {
  name = 'METADATA';
  description = 'Extracts metadata from photos';

  async get(runtime: IAgentRuntime, message: Memory): Promise<any> {
    const content = message.content as any;
    if (!content?.buffer) {
      return null; // Return null instead of throwing when no buffer is present
    }

    // Return the metadata if it's already extracted
    if (content.metadata) {
      return content.metadata;
    }

    // Otherwise extract it from the buffer
    try {
      const metadata = await exifr.parse(content.buffer);
      return metadata || {};
    } catch (error) {
      console.error('Error extracting metadata:', error);
      return {};
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