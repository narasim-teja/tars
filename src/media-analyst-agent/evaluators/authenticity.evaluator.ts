import { Evaluator, IAgentRuntime, Memory } from '@elizaos/core';
import { createHash } from 'crypto';
import { ethers } from 'ethers';

export class AuthenticityEvaluator implements Evaluator {
  name = 'AUTHENTICITY';
  description = 'Verifies photo authenticity using EigenLayer-backed tools';
  similes = ['VERIFY_AUTHENTICITY', 'CHECK_AUTHENTICITY'];
  examples = [];

  async handler(runtime: IAgentRuntime, message: Memory): Promise<{
    isAuthentic: boolean;
    confidence: number;
    verificationDetails: {
      hash: string;
      timestamp: string;
      signatureValid: boolean;
      metadataValid: boolean;
      avsVerification?: {
        taskId: string;
        status: string;
        proofHash?: string;
        verifiers?: string[];
      };
    };
  }> {
    const photoData = message.content as unknown as { 
      buffer: Buffer; 
      metadata: any; 
      timestamp: Date;
      avsVerification?: {
        taskId: string;
        success: boolean;
        message: string;
      };
    };

    try {
      // Generate content hash
      const hash = createHash('sha256')
        .update(new Uint8Array(photoData.buffer))
        .digest('hex');

      // Create verification details
      const verificationDetails = {
        hash,
        timestamp: photoData.timestamp.toISOString(),
        signatureValid: this.validateDeviceSignature(photoData.metadata),
        metadataValid: this.validateMetadata(photoData.metadata),
        avsVerification: photoData.avsVerification ? {
          taskId: photoData.avsVerification.taskId,
          status: photoData.avsVerification.success ? 'VERIFIED' : 'FAILED',
          proofHash: ethers.keccak256(
            ethers.toUtf8Bytes(JSON.stringify({
              hash,
              timestamp: photoData.timestamp,
              metadata: photoData.metadata
            }))
          ),
          verifiers: [] // This would be populated from the AVS contract
        } : undefined
      };

      // Calculate confidence based on all verification factors
      const confidence = this.calculateConfidence(verificationDetails);

      return {
        isAuthentic: verificationDetails.signatureValid && verificationDetails.metadataValid,
        confidence,
        verificationDetails,
      };
    } catch (error) {
      console.error('Error verifying authenticity:', error);
      throw error;
    }
  }

  async validate(runtime: IAgentRuntime, message: Memory): Promise<boolean> {
    const content = message.content as unknown as { buffer: Buffer; metadata: any };
    return !!(content?.buffer && content?.metadata);
  }

  private validateDeviceSignature(metadata: any): boolean {
    // Check if the device is a known Meta Ray-Ban device
    if (!metadata) return false;
    const isMetaDevice = metadata.Make?.includes('Meta') || metadata.Model?.includes('Ray-Ban');
    return isMetaDevice;
  }

  private validateMetadata(metadata: any): boolean {
    if (!metadata) return false;
    
    // Required fields for basic validation
    const requiredFields = [
      'DateTimeOriginal',
      'Make',
      'Model',
      'ImageWidth',
      'ImageHeight'
    ];

    // Check for presence of required fields
    const hasRequiredFields = requiredFields.every(field => metadata[field] !== undefined);

    // Additional metadata validation
    const hasValidTimestamp = metadata.DateTimeOriginal instanceof Date;
    const hasValidDimensions = 
      typeof metadata.ImageWidth === 'number' && 
      typeof metadata.ImageHeight === 'number' &&
      metadata.ImageWidth > 0 &&
      metadata.ImageHeight > 0;

    return hasRequiredFields && hasValidTimestamp && hasValidDimensions;
  }

  private calculateConfidence(verificationDetails: any): number {
    let confidence = 0;
    let factors = 0;

    // Base confidence from metadata validation
    if (verificationDetails.metadataValid) {
      confidence += 0.4;
      factors++;
    }

    // Device signature validation
    if (verificationDetails.signatureValid) {
      confidence += 0.3;
      factors++;
    }

    // AVS verification
    if (verificationDetails.avsVerification?.status === 'VERIFIED') {
      confidence += 0.3;
      factors++;
    }

    // Normalize confidence
    return factors > 0 ? confidence / factors : 0;
  }
} 