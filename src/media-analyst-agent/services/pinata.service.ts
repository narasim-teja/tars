import { elizaLogger } from '@elizaos/core';
import FormData from 'form-data';
import axios from 'axios';
import { FormattedAnalysis } from '../utils/format-analysis';

export interface PinataResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
  isDuplicate?: boolean;
}

export class PinataService {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly jwt: string;
  private readonly baseUrl = 'https://api.pinata.cloud';

  constructor() {
    this.apiKey = process.env.PINATA_API_KEY || '';
    this.apiSecret = process.env.PINATA_API_SECRET || '';
    this.jwt = process.env.PINATA_JWT || '';

    if (!this.jwt && (!this.apiKey || !this.apiSecret)) {
      throw new Error('Pinata credentials not configured. Please set PINATA_JWT or both PINATA_API_KEY and PINATA_API_SECRET');
    }
  }

  private getHeaders() {
    if (this.jwt) {
      return {
        'Authorization': `Bearer ${this.jwt}`
      };
    }
    return {
      'pinata_api_key': this.apiKey,
      'pinata_secret_api_key': this.apiSecret
    };
  }

  async pinFileToIPFS(
    fileBuffer: Buffer,
    fileName: string,
    metadata: Record<string, any>
  ): Promise<PinataResponse> {
    try {
      elizaLogger.info('Pinning file to IPFS:', fileName);
      
      const formData = new FormData();
      formData.append('file', fileBuffer, {
        filename: fileName,
        contentType: 'application/octet-stream',
      });

      // Add metadata
      const pinataMetadata = {
        name: fileName,
        keyvalues: metadata
      };
      formData.append('pinataMetadata', JSON.stringify(pinataMetadata));

      // Add options for custom pin policy
      const pinataOptions = {
        cidVersion: 1,
        wrapWithDirectory: false
      };
      formData.append('pinataOptions', JSON.stringify(pinataOptions));

      const response = await axios.post(
        `${this.baseUrl}/pinning/pinFileToIPFS`,
        formData,
        {
          headers: {
            ...this.getHeaders(),
            ...formData.getHeaders()
          },
          maxContentLength: Infinity,
        }
      );

      elizaLogger.info('File pinned successfully:', response.data);
      return response.data;
    } catch (error) {
      elizaLogger.error('Error pinning file to IPFS:', error);
      throw error;
    }
  }

  async pinJSONToIPFS(
    jsonData: any,
    metadata: Record<string, any>
  ): Promise<PinataResponse> {
    try {
      elizaLogger.info('Pinning JSON to IPFS');

      const response = await axios.post(
        `${this.baseUrl}/pinning/pinJSONToIPFS`,
        {
          pinataContent: jsonData,
          pinataMetadata: {
            name: metadata.name || 'analysis.json',
            keyvalues: metadata
          },
          pinataOptions: {
            cidVersion: 1
          }
        },
        {
          headers: this.getHeaders()
        }
      );

      elizaLogger.info('JSON pinned successfully:', response.data);
      return response.data;
    } catch (error) {
      elizaLogger.error('Error pinning JSON to IPFS:', error);
      throw error;
    }
  }

  async pinAnalysisWithImage(
    analysis: FormattedAnalysis,
    imageBuffer: Buffer,
    metadata: {
      timestamp: string;
      location: string;
      photographer?: string;
      device?: string;
    }
  ): Promise<{
    imageHash: string;
    analysisHash: string;
    urls: {
      image: string;
      analysis: string;
    };
  }> {
    try {
      elizaLogger.info('Pinning analysis and image to IPFS');

      // First pin the image
      const imageResponse = await this.pinFileToIPFS(
        imageBuffer,
        `image-${metadata.timestamp}.jpg`,
        {
          timestamp: metadata.timestamp,
          location: metadata.location,
          type: 'image',
          photographer: metadata.photographer,
          device: metadata.device
        }
      );

      // Then pin the analysis JSON with the image hash reference
      const analysisWithImageHash = {
        ...analysis,
        metadata: {
          ...analysis.metadata,
          image: {
            ipfsHash: imageResponse.IpfsHash,
            url: `https://gateway.pinata.cloud/ipfs/${imageResponse.IpfsHash}`
          }
        }
      };

      const analysisResponse = await this.pinJSONToIPFS(
        analysisWithImageHash,
        {
          name: `analysis-${metadata.timestamp}.json`,
          timestamp: metadata.timestamp,
          location: metadata.location,
          type: 'analysis'
        }
      );

      return {
        imageHash: imageResponse.IpfsHash,
        analysisHash: analysisResponse.IpfsHash,
        urls: {
          image: `https://gateway.pinata.cloud/ipfs/${imageResponse.IpfsHash}`,
          analysis: `https://gateway.pinata.cloud/ipfs/${analysisResponse.IpfsHash}`
        }
      };
    } catch (error) {
      elizaLogger.error('Error pinning analysis with image:', error);
      throw error;
    }
  }
} 