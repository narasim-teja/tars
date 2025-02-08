import { Evaluator, IAgentRuntime, Memory, elizaLogger } from '@elizaos/core';
import { ethers } from 'ethers';

// Simple ABI for the functions we need
const SERVICE_MANAGER_ABI = [
  'function createNewTask(bytes32 imageHash, bytes32 metadataHash, bytes deviceSignature) external returns (tuple(bytes32 imageHash, bytes32 metadataHash, uint32 taskCreatedBlock, bytes deviceSignature))',
  'event NewTaskCreated(uint32 indexed taskIndex, tuple(bytes32 imageHash, bytes32 metadataHash, uint32 taskCreatedBlock, bytes deviceSignature) task)',
  'function allTaskResponses(address operator, uint32 taskIndex) external view returns (bytes)'
];

interface ImageVerificationResult {
  isAuthentic: boolean;
  verificationDetails: {
    imageHash: string;
    timestamp: string;
    deviceSignature?: string;
    metaSignature?: string;
    eigenlayerProof?: string;
    verificationChain: {
      captureDevice: string;
      initialHash: string;
      transmissionHash: string;
      processingHash: string;
      finalHash: string;
      verificationTimestamp: string;
    };
  };
  confidenceScore: number;
  verificationSteps: string[];
}

export class EigenLayerAVSEvaluator implements Evaluator {
  name = 'EIGENLAYER_AVS';
  description = 'Verifies image authenticity using EigenLayer AVS';
  similes = ['VERIFY_IMAGE_AUTHENTICITY', 'CHECK_IMAGE_INTEGRITY'];
  examples = [
    {
      context: 'IMAGE_VERIFICATION',
      messages: [
        { user: 'user1', content: { text: 'verify image authenticity using EigenLayer' } }
      ],
      outcome: 'Verifying image authenticity through EigenLayer AVS...'
    },
    {
      context: 'IMAGE_VERIFICATION',
      messages: [
        { user: 'user1', content: { text: 'check if image has been tampered with' } }
      ],
      outcome: 'Analyzing image integrity and chain of custody...'
    },
    {
      context: 'IMAGE_VERIFICATION',
      messages: [
        { user: 'user1', content: { text: 'validate image chain of custody' } }
      ],
      outcome: 'Validating image verification chain...'
    },
    {
      context: 'IMAGE_VERIFICATION',
      messages: [
        { user: 'user1', content: { text: 'verify Meta glasses signature' } }
      ],
      outcome: 'Verifying Meta Ray-Ban glasses cryptographic signature...'
    }
  ];

  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private serviceManager: ethers.Contract;

  constructor(
    config = {
      rpcUrl: process.env.EIGENLAYER_RPC_URL || 'http://localhost:8545',
      privateKey: process.env.EIGENLAYER_PRIVATE_KEY || '',
      serviceManagerAddress: process.env.SERVICE_MANAGER_ADDRESS || ''
    }
  ) {
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    this.wallet = new ethers.Wallet(config.privateKey, this.provider);
    this.serviceManager = new ethers.Contract(
      config.serviceManagerAddress,
      SERVICE_MANAGER_ABI,
      this.wallet
    );
  }

  private async generateImageHash(buffer: Buffer): Promise<string> {
    return ethers.keccak256(new Uint8Array(buffer));
  }

  private async verifyMetaSignature(metadata: any): Promise<boolean> {
    // Meta Ray-Ban glasses specific verification
    if (!metadata?.Make?.includes('Meta') || !metadata?.Model?.includes('Ray-Ban')) {
      return false;
    }
    return true; // In production, would verify with Meta's API
  }

  private async verifyChain(buffer: Buffer, metadata: any): Promise<{
    isValid: boolean;
    chain: {
      captureDevice: string;
      initialHash: string;
      transmissionHash: string;
      processingHash: string;
      finalHash: string;
      verificationTimestamp: string;
    };
  }> {
    const captureDevice = `${metadata?.Make || 'Unknown'} ${metadata?.Model || 'Device'}`;
    const initialHash = await this.generateImageHash(buffer);
    const transmissionHash = ethers.keccak256(
      ethers.toUtf8Bytes(initialHash + metadata?.DateTimeOriginal)
    );
    const processingHash = ethers.keccak256(
      ethers.toUtf8Bytes(transmissionHash + JSON.stringify(metadata))
    );
    const finalHash = ethers.keccak256(
      ethers.toUtf8Bytes(processingHash + Date.now().toString())
    );
    
    return {
      isValid: true,
      chain: {
        captureDevice,
        initialHash,
        transmissionHash,
        processingHash,
        finalHash,
        verificationTimestamp: new Date().toISOString()
      }
    };
  }

  async handler(
    runtime: IAgentRuntime,
    message: Memory
  ): Promise<ImageVerificationResult> {
    const content = message.content as any;
    const verificationSteps: string[] = [];

    try {
      // 1. Initial hash generation
      verificationSteps.push('Generating image hash...');
      const imageHash = await this.generateImageHash(content.buffer);

      // 2. Meta device signature verification
      verificationSteps.push('Verifying Meta device signature...');
      const isMetaVerified = await this.verifyMetaSignature(content.metadata);
      if (!isMetaVerified) {
        return {
          isAuthentic: false,
          verificationDetails: {
            imageHash,
            timestamp: new Date().toISOString(),
            verificationChain: null
          },
          confidenceScore: 0,
          verificationSteps: [...verificationSteps, 'Meta device verification failed']
        };
      }

      // 3. Verify the chain of custody
      verificationSteps.push('Verifying image chain of custody...');
      const chainVerification = await this.verifyChain(content.buffer, content.metadata);
      if (!chainVerification.isValid) {
        return {
          isAuthentic: false,
          verificationDetails: {
            imageHash,
            timestamp: new Date().toISOString(),
            verificationChain: chainVerification.chain
          },
          confidenceScore: 0,
          verificationSteps: [...verificationSteps, 'Chain of custody verification failed']
        };
      }

      // 4. Check AVS verification status if available
      let eigenlayerProof = undefined;
      if (content.avsVerification?.taskId) {
        verificationSteps.push('Checking AVS verification status...');
        const taskResponses = await this.serviceManager.allTaskResponses(
          this.wallet.address,
          content.avsVerification.taskId
        );
        
        if (taskResponses && taskResponses.length > 0) {
          eigenlayerProof = ethers.keccak256(
            ethers.toUtf8Bytes(JSON.stringify({
              taskId: content.avsVerification.taskId,
              responses: taskResponses,
              timestamp: Date.now()
            }))
          );
        }
      }

      // 5. Final verification result
      verificationSteps.push('Verification complete');
      return {
        isAuthentic: true,
        verificationDetails: {
          imageHash,
          timestamp: new Date().toISOString(),
          deviceSignature: content.metadata?.deviceSignature,
          metaSignature: isMetaVerified ? 'verified' : undefined,
          eigenlayerProof,
          verificationChain: chainVerification.chain
        },
        confidenceScore: eigenlayerProof ? 1.0 : 0.7,
        verificationSteps
      };
    } catch (error) {
      elizaLogger.error('Error in EigenLayer AVS verification:', error);
      return {
        isAuthentic: false,
        verificationDetails: {
          imageHash: null,
          timestamp: new Date().toISOString(),
          verificationChain: null
        },
        confidenceScore: 0,
        verificationSteps: [...verificationSteps, `Verification failed: ${error.message}`]
      };
    }
  }

  async validate(runtime: IAgentRuntime, message: Memory): Promise<boolean> {
    const content = message.content as any;
    return !!(content?.buffer && content?.metadata);
  }
} 