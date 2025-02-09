import { Action, IAgentRuntime, Memory, elizaLogger } from '@elizaos/core';
import { ethers } from 'ethers';

export interface CreateProposalResult {
  success: boolean;
  proposalId?: string;
  message?: string;
  error?: string;
}

// Contract ABI for proposal creation
const CONTRACT_ABI = [
  "function createProposal(string calldata description) external returns (bytes32)",
  "event ProposalCreated(bytes32 indexed proposalId, string description, uint256 deadline)"
];

// Update this with your deployed contract address
const CONTRACT_ADDRESS = "0x24253Bcb1B99a80D521c72717337BaDcfe5C2C40";

export const createProposalAction: Action = {
  name: 'CREATE_PROPOSAL',
  description: 'Create a new proposal in the TARS DAO for a verified social impact initiative',
  similes: ['CREATE_PROPOSAL', 'SUBMIT_PROPOSAL', 'PROPOSE', 'create proposal', 'submit proposal'],
  examples: [
    [{
      user: 'user',
      content: { 
        text: 'Create a proposal for the identified initiative',
        type: 'text'
      }
    }],
    [{
      user: 'user',
      content: {
        text: 'Submit new proposal',
        type: 'text'
      }
    }]
  ],

  async validate(runtime: IAgentRuntime, message: Memory): Promise<boolean> {
    const content = message.content as any;
    const text = content?.text?.toLowerCase() || '';
    return text.includes('create proposal') || text.includes('submit proposal') || text.includes('propose');
  },

  async handler(runtime: IAgentRuntime, message: Memory): Promise<CreateProposalResult> {
    try {
      elizaLogger.info('Starting proposal creation process...');
      
      // Get the proposal details from the message content
      const content = message.content as any;
      if (!content?.mediaAnalysis || !content?.verificationResult) {
        throw new Error('Missing required media analysis or verification result');
      }

      // Format the proposal description
      const description = formatProposalDescription(content.mediaAnalysis, content.verificationResult);

      // Connect to Arbitrum Sepolia
      const provider = new ethers.JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');
      
      // Use the private key from environment variable
      const privateKey = process.env.AGENT_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('Agent private key not configured');
      }

      const wallet = new ethers.Wallet(privateKey, provider);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

      elizaLogger.info('Creating proposal on TARS DAO...');
      
      // Create the proposal
      const tx = await contract.createProposal(description);
      const receipt = await tx.wait();

      // Get the proposal ID from the event
      const event = receipt.logs.find(
        (log: any) => log.topics[0] === contract.interface.getEvent('ProposalCreated').topicHash
      )!;

      if (!event) {
        throw new Error('Proposal creation event not found');
      }

      const parsedEvent = contract.interface.parseLog({
        topics: event.topics,
        data: event.data
      });

      const proposalId = parsedEvent?.args?.[0];

      elizaLogger.info('Proposal created successfully with ID:', proposalId);

      return {
        success: true,
        proposalId,
        message: `Proposal created successfully\nID: ${proposalId}\nDescription: ${description}`
      };

    } catch (error) {
      elizaLogger.error('Error creating proposal:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
};

function formatProposalDescription(mediaAnalysis: any, verificationResult: any): string {
  // Format the proposal description using the analysis and verification data
  const description = `
    Impact Initiative Proposal

    Location: ${mediaAnalysis.location}
    Impact Score: ${mediaAnalysis.impactScore}
    Verification Status: ${verificationResult.verified ? 'Verified' : 'Pending'}

    Description:
    ${mediaAnalysis.analysis}

    Verification Details:
    ${verificationResult.details}

    Proposed Action:
    ${mediaAnalysis.recommendedAction || 'Community support and resource allocation required.'}

    Evidence:
    - Media Analysis: ${mediaAnalysis.evidenceUrl || 'Available upon request'}
    - Verification Report: ${verificationResult.reportUrl || 'Available upon request'}
  `.trim();

  return description;
} 