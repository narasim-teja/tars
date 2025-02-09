import { Action, IAgentRuntime, Memory, elizaLogger } from '@elizaos/core';
import exifr from 'exifr';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';
import heicConvert from 'heic-convert';
import sharp from 'sharp';
import { ImageAnalysisProvider } from '../providers/image-analysis.provider.js';
import { formatAnalysisForIPFS } from '../utils/format-analysis.js';
import { PinataService } from '../services/pinata.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple ABI for the functions we need
const SERVICE_MANAGER_ABI = [
  'function createNewTask(bytes32 imageHash, bytes32 metadataHash, bytes deviceSignature) external returns (tuple(bytes32 imageHash, bytes32 metadataHash, uint32 taskCreatedBlock, bytes deviceSignature))',
  'event NewTaskCreated(uint32 indexed taskIndex, tuple(bytes32 imageHash, bytes32 metadataHash, uint32 taskCreatedBlock, bytes deviceSignature) task)'
];

interface PhotoData {
  buffer: Buffer;
  mimeType: string;
  metadata?: {
    exif?: any;
    gps?: {
      latitude?: number;
      longitude?: number;
    };
    weather?: any;
    latitude?: number;
    longitude?: number;
    DateTimeOriginal?: Date;
    Make?: string;
    Model?: string;
    ImageWidth?: number;
    ImageHeight?: number;
    FNumber?: number;
    ApertureValue?: number;
    FocalLength?: number;
    ISO?: number;
    ExposureTime?: number;
    Flash?: boolean;
  };
  hash?: string;
  taskId?: string;
  timestamp?: Date;
  location?: {
    lat: number;
    lng: number;
  };
}

export interface AnalysisResult {
  success: boolean;
  data: {
    imageAnalysis: any;
    metadata: {
      exif?: any;
      gps?: {
        latitude?: number;
        longitude?: number;
      };
      weather?: any;
      news?: any;
    };
  };
  outputPath?: string;
}

export class AnalyzePhotoAction implements Action {
  name = 'ANALYZE_PHOTO';
  description = 'Analyzes photos and extracts metadata, context, and verifies authenticity';
  similes = ['PROCESS_PHOTO', 'EXAMINE_PHOTO', 'process', 'analyze'];
  examples = [];

  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private serviceManager: ethers.Contract;
  private runtime: IAgentRuntime;

  constructor(runtime: IAgentRuntime) {
    this.runtime = runtime;

    const avsConfig = {
      rpcUrl: process.env.EIGENLAYER_RPC_URL || 'http://localhost:8545',
      privateKey: process.env.OPERATOR_PRIVATE_KEY || '',
      serviceManagerAddress: process.env.SERVICE_MANAGER_ADDRESS || ''
    };

    // Only initialize AVS components if environment variables are set
    if (avsConfig.rpcUrl && avsConfig.privateKey && avsConfig.serviceManagerAddress) {
      try {
        // Initialize ethers provider and wallet
        this.provider = new ethers.JsonRpcProvider(avsConfig.rpcUrl);
        this.wallet = new ethers.Wallet(avsConfig.privateKey, this.provider);
        
        // Initialize service manager contract
        this.serviceManager = new ethers.Contract(
          avsConfig.serviceManagerAddress,
          SERVICE_MANAGER_ABI,
          this.wallet
        );
      } catch (error) {
        elizaLogger.error('Error initializing AVS components:', error);
      }
    } else {
      elizaLogger.warn('AVS environment variables not configured. AVS verification will be skipped.');
    }
  }

  private async convertHeicToBuffer(buffer: Buffer): Promise<Buffer> {
    try {
      elizaLogger.info('Converting HEIC to JPEG...');
      const jpegBuffer = await heicConvert({
        buffer: buffer,
        format: 'JPEG',
        quality: 0.9
      });

      // Resize the converted image if it's too large
      const MAX_SIZE = 5 * 1024 * 1024; // 5MB
      if (jpegBuffer.length > MAX_SIZE) {
        elizaLogger.info('Converted JPEG exceeds 5MB, resizing...');
        let quality = 80;
        let resizedBuffer = await sharp(jpegBuffer)
          .jpeg({ quality })
          .toBuffer();

        while (resizedBuffer.length > MAX_SIZE && quality > 30) {
          quality -= 10;
          resizedBuffer = await sharp(jpegBuffer)
            .jpeg({ quality })
            .toBuffer();
          elizaLogger.info(`Resizing with quality ${quality}%, size: ${resizedBuffer.length / 1024 / 1024}MB`);
        }

        if (resizedBuffer.length > MAX_SIZE) {
          elizaLogger.info('Still too large, reducing dimensions...');
          resizedBuffer = await sharp(jpegBuffer)
            .resize(1600, 1600, { fit: 'inside' })
            .jpeg({ quality: Math.max(quality, 30) })
            .toBuffer();
        }

        return resizedBuffer;
      }

      return jpegBuffer;
    } catch (error) {
      elizaLogger.error('Error converting/resizing HEIC:', error);
      throw error;
    }
  }

  private async sendToAVS(buffer: Buffer, metadata: any): Promise<{
    taskId: string;
    success: boolean;
    message: string;
  }> {
    try {
      // Check if required environment variables are set
      if (!process.env.EIGENLAYER_RPC_URL || !process.env.OPERATOR_PRIVATE_KEY || !process.env.SERVICE_MANAGER_ADDRESS) {
        return {
          taskId: '',
          success: false,
          message: 'AVS environment variables not configured. Skipping AVS verification.'
        };
      }

      // Create hashes for image and metadata
      const imageHash = ethers.keccak256(new Uint8Array(buffer));
      const metadataHash = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify(metadata || {}))
      );

      // Create device signature (in a real implementation, this would come from the Meta device)
      const deviceSignature = ethers.toUtf8Bytes('meta-device-signature');

      try {
        // Send to AVS
        const tx = await this.serviceManager.createNewTask(
          imageHash,
          metadataHash,
          deviceSignature
        );

        // Wait for transaction confirmation
        const receipt = await tx.wait();
        
        // Get task ID from event
        const event = receipt.logs
          .map(log => this.serviceManager.interface.parseLog(log))
          .find(event => event?.name === 'NewTaskCreated');
        
        const taskId = event?.args?.taskIndex?.toString();

        return {
          taskId,
          success: true,
          message: `Image verification task created successfully. Task ID: ${taskId}`
        };
      } catch (error) {
        elizaLogger.error('Error interacting with AVS contract:', error);
        return {
          taskId: '',
          success: false,
          message: `AVS contract interaction failed: ${error.message}`
        };
      }
    } catch (error) {
      elizaLogger.error('Error in AVS processing:', error);
      return {
        taskId: '',
        success: false,
        message: `AVS processing error: ${error.message}`
      };
    }
  }

  async validate(runtime: IAgentRuntime, message: Memory): Promise<boolean> {
    // Accept either a direct photo buffer or a text command to process photos
    const content = message.content as any;
    return !!(content?.buffer) || 
           !!(content?.text?.toLowerCase().match(/process|analyze/));
  }

  async handler(runtime: IAgentRuntime, message: Memory): Promise<AnalysisResult | AnalysisResult[]> {
    const content = message.content as any;

    // If this is a text command to process photos
    if (content?.text?.toLowerCase().match(/process|analyze/)) {
      const testPhotoDir = path.join(__dirname, '../../../test/photos');
      
      try {
        // Ensure the photos directory exists
        await fs.mkdir(testPhotoDir, { recursive: true });
        elizaLogger.info(`Checking for photos in directory: ${testPhotoDir}`);
        
        const files = await fs.readdir(testPhotoDir);
        const supportedExtensions = ['.jpg', '.jpeg', '.png', '.heic'];
        
        const photoFiles = files.filter(file => 
          supportedExtensions.includes(path.extname(file).toLowerCase())
        );

        elizaLogger.info(`Found ${photoFiles.length} photos to process`);

        if (photoFiles.length === 0) {
          const message = 'No photos found in the test/photos directory. Please add some photos and try again.';
          elizaLogger.warn(message);
          throw new Error(message);
        }

        // Process each photo
        const results = [];
        for (const file of photoFiles) {
          const filePath = path.join(testPhotoDir, file);
          elizaLogger.info(`Processing photo: ${file}`);
          
          // Read the original file
          const buffer = await fs.readFile(filePath);
          
          // Extract metadata first before any conversion
          elizaLogger.info('Extracting metadata...');
          const originalMetadata = await exifr.parse(buffer, {
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
          elizaLogger.info('Metadata extracted:', originalMetadata);
          
          // Convert HEIC to JPEG only for processing if needed, but keep original metadata
          let processedBuffer = buffer;
          if (path.extname(file).toLowerCase() === '.heic') {
            elizaLogger.info('Converting HEIC to JPEG for processing...');
            processedBuffer = await this.convertHeicToBuffer(buffer);
          }
          
          // Send to AVS first
          elizaLogger.info('Sending to AVS for verification...');
          const avsResult = await this.sendToAVS(processedBuffer, originalMetadata);
          elizaLogger.info('AVS Result:', avsResult);
          
          // Then do regular analysis using original metadata
          elizaLogger.info('Performing photo analysis...');
          const result = await this.analyzePhoto(runtime, {
            buffer: processedBuffer,
            mimeType: 'image/jpeg',
            metadata: originalMetadata,
            timestamp: originalMetadata?.DateTimeOriginal || new Date(),
            location: originalMetadata?.latitude && originalMetadata?.longitude ? {
              lat: originalMetadata.latitude,
              lng: originalMetadata.longitude
            } : undefined
          });

          elizaLogger.info(`Analysis complete for ${file}:`, result);
          
          const finalResult = {
            file,
            ...result,
            avsVerification: avsResult
          };
          
          results.push(finalResult);
          elizaLogger.info(`Final result for ${file}:`, finalResult);
        }

        elizaLogger.info('All photos processed successfully');
        return results;
      } catch (error) {
        elizaLogger.error('Error processing photos:', error);
        throw error;
      }
    }

    // If this is a direct photo analysis request
    const photoData = content as PhotoData;
    if (!photoData?.buffer) {
      const message = 'Photo data is required';
      elizaLogger.error(message);
      throw new Error(message);
    }

    elizaLogger.info('Processing direct photo analysis request...');

    // Extract metadata first
    const metadata = await exifr.parse(photoData.buffer, {
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

    // Send to AVS first
    elizaLogger.info('Sending to AVS for verification...');
    const avsResult = await this.sendToAVS(photoData.buffer, metadata);
    elizaLogger.info('AVS Result:', avsResult);

    // Then do regular analysis
    elizaLogger.info('Performing photo analysis...');
    const result = await this.analyzePhoto(runtime, {
      buffer: photoData.buffer,
      mimeType: 'image/jpeg',
      metadata,
      timestamp: metadata?.DateTimeOriginal || photoData.timestamp || new Date(),
      location: metadata?.latitude && metadata?.longitude ? {
        lat: metadata.latitude,
        lng: metadata.longitude
      } : undefined
    });

    elizaLogger.info('Analysis complete:', result);
    const finalResult = {
      ...result,
      avsVerification: avsResult
    };

    elizaLogger.info('Final result:', finalResult);
    return finalResult;
  }

  private async analyzePhoto(runtime: IAgentRuntime, photoData: PhotoData): Promise<AnalysisResult> {
    try {
      // Initialize Pinata service
      const pinataService = new PinataService();

      // Generate hash for authenticity
      const hash = ethers.keccak256(new Uint8Array(photoData.buffer));

      // Resize the image if needed (for non-HEIC images)
      const MAX_SIZE = 5 * 1024 * 1024; // 5MB
      let processedBuffer = photoData.buffer;
      if (processedBuffer.length > MAX_SIZE) {
        elizaLogger.info('Image exceeds 5MB, resizing...');
        let quality = 80;
        processedBuffer = await sharp(photoData.buffer)
          .jpeg({ quality })
          .toBuffer();

        while (processedBuffer.length > MAX_SIZE && quality > 30) {
          quality -= 10;
          processedBuffer = await sharp(photoData.buffer)
            .resize(2000, 2000, { fit: 'inside' })
            .jpeg({ quality })
            .toBuffer();
        }
        elizaLogger.info(`Image resized successfully. New size: ${processedBuffer.length} bytes`);
      }

      // Extract GPS coordinates from metadata
      let coordinates = null;
      if (photoData.metadata?.latitude && photoData.metadata?.longitude) {
        coordinates = {
          lat: photoData.metadata.latitude,
          lng: photoData.metadata.longitude
        };
        elizaLogger.info('Found GPS coordinates in photo metadata:', coordinates);
      } else if (photoData.metadata?.gps?.latitude && photoData.metadata?.gps?.longitude) {
        coordinates = {
          lat: photoData.metadata.gps.latitude,
          lng: photoData.metadata.gps.longitude
        };
        elizaLogger.info('Found GPS coordinates in photo metadata (gps):', coordinates);
      }

      // Get image analysis first
      let imageAnalysis = null;
      const imageAnalysisProvider = runtime.providers.find(p => (p as any).name === 'IMAGE_ANALYSIS');
      if (imageAnalysisProvider) {
        elizaLogger.info('Getting image analysis...');
        const imageAnalysisMemory = {
          userId: runtime.agentId,
          roomId: runtime.agentId,
          agentId: runtime.agentId,
          content: { 
            text: 'analyze image',
            imageUrl: `data:image/jpeg;base64,${processedBuffer.toString('base64')}`,
            type: 'text'
          }
        };
        try {
          imageAnalysis = await imageAnalysisProvider.get(runtime, imageAnalysisMemory);
          elizaLogger.info('Image analysis result:', imageAnalysis);
        } catch (error) {
          elizaLogger.error('Error during image analysis:', error);
        }
      }

      // Get location details if coordinates are available
      let locationDetails = null;
      let weatherData = null;
      let newsData = null;
      if (coordinates) {
        elizaLogger.info('Using coordinates for providers:', coordinates);
        const locationProvider = runtime.providers.find(p => (p as any).name === 'LOCATION');
        const weatherProvider = runtime.providers.find(p => (p as any).name === 'WEATHER');
        const newsProvider = runtime.providers.find(p => (p as any).name === 'NEWS');
        
        const memoryWithLocation = {
          userId: runtime.agentId,
          roomId: runtime.agentId,
          agentId: runtime.agentId,
          content: { 
            text: '',
            buffer: processedBuffer, 
            location: coordinates,
            timestamp: photoData.metadata?.DateTimeOriginal || photoData.timestamp || new Date()
          }
        };
        
        if (locationProvider) {
          elizaLogger.info('Getting location details...');
          locationDetails = await locationProvider.get(runtime, memoryWithLocation);
          elizaLogger.info('Location details:', locationDetails);
        }
        
        if (weatherProvider) {
          elizaLogger.info('Getting weather data...');
          weatherData = await weatherProvider.get(runtime, memoryWithLocation);
          elizaLogger.info('Weather data:', weatherData);
        }
        
        if (newsProvider) {
          elizaLogger.info('Getting news data...');
          newsData = await newsProvider.get(runtime, memoryWithLocation);
          elizaLogger.info('News data:', newsData);
        }
      } else {
        elizaLogger.info('No GPS coordinates found in photo metadata');
      }

      // Format the analysis data for IPFS
      const formattedData = formatAnalysisForIPFS(
        {
          timestamp: photoData.metadata?.DateTimeOriginal || photoData.timestamp || new Date(),
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
          hash,
          imageAnalysis
        },
        photoData.metadata,
        {
          location: locationDetails,
          weather: weatherData,
          news: newsData
        },
        {
          success: true,
          taskId: photoData.taskId
        }
      );

      // Create output directory if it doesn't exist
      const outputDir = path.join(process.cwd(), 'src', 'output');
      await fs.mkdir(outputDir, { recursive: true });

      // Save formatted data to JSON file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputPath = path.join(outputDir, `analysis-${timestamp}.json`);
      await fs.writeFile(outputPath, JSON.stringify(formattedData, null, 2));
      elizaLogger.info(`Analysis data saved to ${outputPath}`);

      // Upload to IPFS using Pinata
      const locationString = [
        locationDetails?.city,
        locationDetails?.state,
        locationDetails?.country
      ].filter(Boolean).join(', ');

      const ipfsResult = await pinataService.pinAnalysisWithImage(
        formattedData,
        processedBuffer,
        {
          timestamp,
          location: locationString,
          device: `${photoData.metadata?.Make || ''} ${photoData.metadata?.Model || ''}`.trim() || 'Unknown',
          photographer: 'TARS User' // You can make this configurable if needed
        }
      );

      elizaLogger.info('Content uploaded to IPFS:', ipfsResult);

      // Add IPFS data to the result
      return {
        success: true,
        data: {
          imageAnalysis: {
            ...formattedData,
            ipfs: {
              imageUrl: ipfsResult.urls.image,
              analysisUrl: ipfsResult.urls.analysis,
              imageHash: ipfsResult.imageHash,
              analysisHash: ipfsResult.analysisHash
            }
          },
          metadata: {
            exif: photoData.metadata?.exif,
            gps: photoData.metadata?.gps,
            weather: weatherData,
            news: newsData
          }
        },
        outputPath
      };
    } catch (error) {
      elizaLogger.error('Error analyzing photo:', error);
      throw error;
    }
  }
} 


