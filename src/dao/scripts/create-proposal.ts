import { ethers } from "hardhat";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Contract ABI for proposal creation
const CONTRACT_ABI = [
  "function createProposal(string calldata description) external returns (bytes32)",
  "event ProposalCreated(bytes32 indexed proposalId, string description, uint256 deadline)"
];

interface ProposalData {
  location: string;
  impactScore: number;
  analysis: string;
  recommendedAction: string;
  verificationStatus: boolean;
  verificationDetails: string;
  evidenceUrl?: string;
  reportUrl?: string;
}

export async function createProposal(data: ProposalData) {
  console.log("Creating proposal on SimpleDAO...");

  // Get the private key and check if it exists
  const privateKey = process.env.CREATE_PROPOSAL_PRIVATE_KEY;
  const contractAddress = process.env.DAO_CONTRACT_ADDRESS;
  if (!privateKey) {
    throw new Error("CREATE_PROPOSAL_PRIVATE_KEY not found in environment variables");
  }
  if (!contractAddress) {
    throw new Error("DAO_CONTRACT_ADDRESS not found in environment variables");
  }

  // Connect to Arbitrum Sepolia
  const provider = new ethers.JsonRpcProvider(process.env.ARB_SEPOLIA_RPC_URL);
  const wallet = new ethers.Wallet(privateKey, provider);

  // Get the deployed contract address
  const CONTRACT_ADDRESS = contractAddress;

  // Get the contract instance
  const dao = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

  // Format the proposal description
  const description = `
    Impact Initiative Proposal

    Location: ${data.location}
    Impact Score: ${data.impactScore}
    Verification Status: ${data.verificationStatus ? 'Verified' : 'Pending'}

    Description:
    ${data.analysis}

    Verification Details:
    ${data.verificationDetails}

    Proposed Action:
    ${data.recommendedAction}

    Evidence:
    - Media Analysis: ${data.evidenceUrl || 'Available upon request'}
    - Verification Report: ${data.reportUrl || 'Available upon request'}
  `.trim();

  try {
    // Create the proposal
    console.log("Submitting proposal transaction...");
    const tx = await dao.createProposal(description);
    console.log("Transaction hash:", tx.hash);

    // Wait for the transaction to be mined
    console.log("Waiting for transaction confirmation...");
    const receipt = await tx.wait();

    // Get the proposal ID from the event
    const event = receipt.logs.find(
      (log: any) => log.topics[0] === dao.interface.getEvent('ProposalCreated')!.topicHash
    )!;

    if (!event) {
      throw new Error('Proposal creation event not found');
    }

    const parsedEvent = dao.interface.parseLog({
      topics: event.topics,
      data: event.data
    });

    const proposalId = parsedEvent?.args?.[0];
    
    return {
      success: true,
      proposalId,
      description,
      txHash: tx.hash
    };

  } catch (error) {
    console.error("Error creating proposal:", error);
    throw error;
  }
}

// Allow running directly from command line
if (require.main === module) {
  // Example usage
  const testData: ProposalData = {
    location: "Test Location",
    impactScore: 85,
    analysis: "Test social impact initiative for community development.",
    recommendedAction: "Implementation of community-driven development program.",
    verificationStatus: true,
    verificationDetails: "Verified by community stakeholders and local authorities.",
    evidenceUrl: "https://example.com/test-evidence",
    reportUrl: "https://example.com/test-report"
  };

  createProposal(testData)
    .then(result => {
      console.log("Proposal created successfully!");
      console.log("Proposal ID:", result.proposalId);
      console.log("Description:", result.description);
    })
    .catch(error => {
      console.error(error);
      process.exitCode = 1;
    });
}
