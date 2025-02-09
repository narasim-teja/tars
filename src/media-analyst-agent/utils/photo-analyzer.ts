import { MediaAnalystAgent } from '../agent.js';
import fs from 'fs/promises';
import path from 'path';
import { elizaLogger } from '@elizaos/core';
import heicConvert from 'heic-convert';
import exifr from 'exifr';
import { ethers } from 'ethers';
import { createHash } from 'crypto';

// Simple ABI for the functions we need
const SERVICE_MANAGER_ABI = [
  'function createNewTask(bytes32 imageHash, bytes32 metadataHash, bytes deviceSignature) external returns (tuple(bytes32 imageHash, bytes32 metadataHash, uint32 taskCreatedBlock, bytes deviceSignature))',
  'event NewTaskCreated(uint32 indexed taskIndex, tuple(bytes32 imageHash, bytes32 metadataHash, uint32 taskCreatedBlock, bytes deviceSignature) task)'
];

export class PhotoAnalyzer {
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private serviceManager: ethers.Contract;

  constructor(
    private agent: MediaAnalystAgent,
    avsConfig = {
      rpcUrl: 'http://localhost:8545',
      privateKey: process.env.OPERATOR_PRIVATE_KEY || '',
      serviceManagerAddress: process.env.SERVICE_MANAGER_ADDRESS || ''
    }
  ) {
    // Initialize ethers provider and wallet
    this.provider = new ethers.JsonRpcProvider(avsConfig.rpcUrl);
    this.wallet = new ethers.Wallet(avsConfig.privateKey, this.provider);
    
    // Initialize service manager contract
    this.serviceManager = new ethers.Contract(
      avsConfig.serviceManagerAddress,
      SERVICE_MANAGER_ABI,
      this.wallet
    );
  }

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

  private async sendToAVS(buffer: Buffer, metadata: any): Promise<{
    taskId: string;
    success: boolean;
    message: string;
  }> {
    try {
      // Create hashes for image and metadata
      const imageHash = ethers.keccak256(new Uint8Array(buffer));
      const metadataHash = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify(metadata))
      );

      // Create device signature (in a real implementation, this would come from the Meta device)
      const deviceSignature = ethers.toUtf8Bytes('meta-device-signature');

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
      elizaLogger.error('Error sending to AVS:', error);
      return {
        taskId: '',
        success: false,
        message: `Failed to send to AVS: ${error.message}`
      };
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
      
      // Send to AVS first
      const avsResult = await this.sendToAVS(processedBuffer, originalMetadata);
      elizaLogger.info('AVS Result:', avsResult);

      // Continue with regular analysis
      const analysisResult = await this.agent.analyzePhoto({
        buffer: processedBuffer,
        metadata: originalMetadata,
        timestamp: originalMetadata.DateTimeOriginal || new Date(),
        location: originalMetadata.location
      });

      elizaLogger.info('Analysis result:', analysisResult);
      return {
        ...(analysisResult as any),
        avsVerification: avsResult
      };
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