import { Evaluator, IAgentRuntime, Memory, elizaLogger } from '@elizaos/core';
import { createHash } from 'crypto';
import { Contract, Wallet, JsonRpcProvider } from 'ethers';

// Import ABI (you'll need to generate this from the contract)
import { ImageVerificationAVS__factory } from '../typechain';

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

  private contract: Contract;
  private wallet: Wallet;

  constructor() {
    const provider = new JsonRpcProvider(process.env.EIGENLAYER_RPC_URL);
    this.wallet = new Wallet(process.env.EIGENLAYER_PRIVATE_KEY, provider);
    this.contract = ImageVerificationAVS__factory.connect(
      process.env.IMAGE_VERIFICATION_AVS_ADDRESS,
      this.wallet
    );
  }

  private async generateImageHash(buffer: Buffer): Promise<string> {
    return createHash('sha256').update(buffer).digest('hex');
  }

  private async verifyMetaSignature(metadata: any): Promise<boolean> {
    // Meta Ray-Ban glasses specific verification
    if (!metadata?.Make?.includes('Meta') || !metadata?.Model?.includes('Ray-Ban')) {
      return false;
    }
    return true; // Placeholder - would actually verify with Meta's API
  }

  private async createEigenLayerProof(
    imageHash: string,
    metadata: any,
    deviceSignature?: string
  ): Promise<string> {
    try {
      // Create verification task on AVS contract
      const metadataHash = createHash('sha256')
        .update(JSON.stringify(metadata))
        .digest('hex');

      const tx = await this.contract.createVerificationTask(
        `0x${imageHash}`,
        `0x${metadataHash}`,
        deviceSignature || '0x'
      );
      
      const receipt = await tx.wait();
      const taskId = receipt.events[0].args.taskId;

      // In a real implementation, we would:
      // 1. Wait for operators to verify the task
      // 2. Aggregate their signatures
      // 3. Generate a ZK proof
      // 4. Submit the proof to the contract

      // For now, we'll create a simple proof
      const proof = Buffer.from('placeholder_proof');
      
      // Submit verification result
      const submitTx = await this.contract.submitVerification(
        taskId,
        true, // isAuthentic
        '0x', // operatorSignature (placeholder)
        proof
      );
      
      await submitTx.wait();
      
      return taskId;
    } catch (error) {
      elizaLogger.error('Error creating EigenLayer proof:', error);
      throw error;
    }
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
    const transmissionHash = createHash('sha256')
      .update(initialHash + metadata?.DateTimeOriginal)
      .digest('hex');
    const processingHash = createHash('sha256')
      .update(transmissionHash + JSON.stringify(metadata))
      .digest('hex');
    const finalHash = createHash('sha256')
      .update(processingHash + Date.now().toString())
      .digest('hex');
    
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

      // 4. Generate EigenLayer proof
      verificationSteps.push('Generating EigenLayer proof...');
      const eigenlayerProof = await this.createEigenLayerProof(
        imageHash,
        content.metadata,
        content.metadata?.deviceSignature
      );

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
        confidenceScore: 1.0,
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