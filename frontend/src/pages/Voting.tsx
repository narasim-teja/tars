import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useDynamicContext, useIsLoggedIn } from '@dynamic-labs/sdk-react-core';

// Contract ABI for SimpleDAO
const CONTRACT_ABI = [
  "function createProposal(string calldata description) external returns (bytes32)",
  "function vote(bytes32 proposalId, bool support) external",
  "function executeProposal(bytes32 proposalId) external",
  "function getProposal(bytes32 proposalId) external view returns (string description, uint256 forVotes, uint256 againstVotes, uint256 deadline, bool executed, bool exists)",
  "function hasVoted(bytes32 proposalId, address voter) external view returns (bool)",
  "function isMember(address account) external view returns (bool)",
  "function joinDAO() external payable",
  "function leaveDAO() external",
  "function getMemberStake(address member) external view returns (uint256)",
  "function MINIMUM_STAKE() external pure returns (uint256)",
  "event ProposalCreated(bytes32 indexed proposalId, string description, uint256 deadline)",
  "event Voted(bytes32 indexed proposalId, address indexed voter, bool support)",
  "event ProposalExecuted(bytes32 indexed proposalId)",
  "event MemberJoined(address indexed member, uint256 stake)",
  "event MemberLeft(address indexed member, uint256 stake)"
];


const CONTRACT_ADDRESS = "0x24253Bcb1B99a80D521c72717337BaDcfe5C2C40";

interface Proposal {
  id: string;
  description: string;
  forVotes: number;
  againstVotes: number;
  deadline: string;
  executed: boolean;
  exists: boolean;
  hasVoted: boolean;
  status: 'active' | 'passed' | 'rejected' | 'pending';
  parsedData?: {
    location: string;
    impactScore: number;
    verificationStatus: string;
    description: string;
    verificationDetails: string;
    proposedAction: string;
    evidence: {
      mediaAnalysis: string;
      verificationReport: string;
    };
  };
}

// Add helper function to parse proposal description
const parseProposalDescription = (descriptionText: string): Proposal['parsedData'] => {
  try {
    const lines = descriptionText.split('\n').map(line => line.trim());
    
    // Helper function to extract content between labels
    const extractContent = (startLabel: string, endLabels: string[]): string => {
      const startIndex = lines.findIndex(l => l.startsWith(startLabel));
      if (startIndex === -1) return '';
      
      const endIndex = lines.findIndex((l, i) => 
        i > startIndex && endLabels.some(label => l.startsWith(label))
      );
      
      if (endIndex === -1) {
        return lines.slice(startIndex + 1).join('\n').trim();
      }
      return lines.slice(startIndex + 1, endIndex).join('\n').trim();
    };

    // Extract single line values
    const location = lines.find(l => l.startsWith('Location:'))?.split('Location:')[1]?.trim() || '';
    const impactScore = parseInt(lines.find(l => l.startsWith('Impact Score:'))?.split('Impact Score:')[1]?.trim() || '0');
    const verificationStatus = lines.find(l => l.startsWith('Verification Status:'))?.split('Verification Status:')[1]?.trim() || '';

    // Extract multi-line content
    const description = extractContent('Description:', ['Verification Details:', 'Proposed Action:', 'Evidence:']);
    const verificationDetails = extractContent('Verification Details:', ['Proposed Action:', 'Evidence:', 'Description:']);
    const proposedAction = extractContent('Proposed Action:', ['Evidence:', 'Description:', 'Verification Details:']);

    // Extract evidence URLs
    const mediaAnalysis = lines.find(l => l.includes('Media Analysis:'))?.split('Media Analysis:')[1]?.trim() || '';
    const verificationReport = lines.find(l => l.includes('Verification Report:'))?.split('Verification Report:')[1]?.trim() || '';

    return {
      location,
      impactScore,
      verificationStatus,
      description,
      verificationDetails,
      proposedAction,
      evidence: {
        mediaAnalysis,
        verificationReport
      }
    };
  } catch (error) {
    console.error('Error parsing proposal description:', error);
    return undefined;
  }
};

export default function Voting() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [memberStake, setMemberStake] = useState<string>('0');
  
  const { primaryWallet, setShowAuthFlow } = useDynamicContext();
  const isLoggedIn = useIsLoggedIn();

  const getContract = async (shouldShowAuth: boolean = false) => {
    if (!isLoggedIn || !primaryWallet) {
      if (shouldShowAuth) {
        setShowAuthFlow(true);
      }
      throw new Error('Please connect your wallet first');
    }

    try {
      if (!window.ethereum) {
        throw new Error('No Ethereum provider found');
      }

      const ethersProvider = new ethers.BrowserProvider(window.ethereum);
      const signer = await ethersProvider.getSigner();
      
      // Verify the signer's address matches the connected wallet
      const signerAddress = await signer.getAddress();
      if (signerAddress.toLowerCase() !== primaryWallet.address.toLowerCase()) {
        throw new Error('Wallet address mismatch');
      }

      return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
    } catch (error) {
      console.error('Error creating contract instance:', error);
      throw new Error('Failed to connect to wallet. Please make sure you are connected to Arbitrum Sepolia network.');
    }
  };

  const handleJoinDAO = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const contract = await getContract(true);
      const minStake = await contract.MINIMUM_STAKE();
      
      const tx = await contract.joinDAO({ value: minStake });
      await tx.wait();
      
      await checkMembership();
    } catch (err) {
      console.error('Error joining DAO:', err);
      setError(err instanceof Error ? err.message : 'Error joining DAO');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveDAO = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const contract = await getContract(true);
      const tx = await contract.leaveDAO();
      await tx.wait();
      
      await checkMembership();
    } catch (err) {
      console.error('Error leaving DAO:', err);
      setError(err instanceof Error ? err.message : 'Error leaving DAO');
    } finally {
      setLoading(false);
    }
  };

  const checkMembership = async () => {
    if (!primaryWallet?.address) return;

    try {
      const contract = await getContract();
      const [memberStatus, stake] = await Promise.all([
        contract.isMember(primaryWallet.address),
        contract.getMemberStake(primaryWallet.address)
      ]);
      
      setIsMember(memberStatus);
      setMemberStake(ethers.formatEther(stake));
    } catch (err) {
      console.error('Error checking membership:', err);
      setError(err instanceof Error ? err.message : 'Error checking membership');
    }
  };

  const handleVote = async (proposalId: string, support: boolean) => {
    try {
      setLoading(true);
      setError(null);
      
      const contract = await getContract(true);
      const tx = await contract.vote(proposalId, support);
      await tx.wait();
      
      await loadProposals();
    } catch (err) {
      console.error('Error voting:', err);
      setError(err instanceof Error ? err.message : 'Error while voting');
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async (proposalId: string) => {
    try {
      setLoading(true);
      setError(null);
      
      const contract = await getContract(true);
      const tx = await contract.executeProposal(proposalId);
      await tx.wait();
      
      await loadProposals();
    } catch (err) {
      console.error('Error executing proposal:', err);
      setError(err instanceof Error ? err.message : 'Error executing proposal');
    } finally {
      setLoading(false);
    }
  };

  const loadProposals = async () => {
    try {
      setLoading(true);
      
      if (!isLoggedIn || !primaryWallet) {
        setProposals([]);
        return;
      }

      const contract = await getContract(false);
      
      // Get ProposalCreated events
      const filter = contract.filters.ProposalCreated();
      const events = await contract.queryFilter(filter);
      
      const loadedProposals: Proposal[] = [];
      
      for (const event of events) {
        const proposalId = (event as ethers.EventLog).args?.[0];
        if (!proposalId) continue;

        const [
          description,
          forVotes,
          againstVotes,
          deadline,
          executed,
          exists
        ] = await contract.getProposal(proposalId);

        if (!exists) continue;

        const hasVoted = await contract.hasVoted(proposalId, primaryWallet.address);
        const now = Math.floor(Date.now() / 1000);
        
        let status: Proposal['status'] = 'active';
        if (executed) {
          status = 'passed';
        } else if (now > Number(deadline)) {
          status = Number(forVotes) > Number(againstVotes) ? 'passed' : 'rejected';
        }

        loadedProposals.push({
          id: proposalId,
          description,
          forVotes: Number(forVotes),
          againstVotes: Number(againstVotes),
          deadline: new Date(Number(deadline) * 1000).toISOString(),
          executed,
          exists,
          hasVoted,
          status,
          parsedData: parseProposalDescription(description)
        });
      }
      
      setProposals(loadedProposals);
    } catch (err) {
      console.error('Error loading proposals:', err);
      setError(err instanceof Error ? err.message : 'Error loading proposals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      if (primaryWallet?.address) {
        try {
          await checkMembership();
          await loadProposals();
        } catch (err) {
          console.error('Error initializing:', err);
          setError('Failed to initialize. Please make sure you are connected to Arbitrum Sepolia network.');
        }
      }
    };

    init();
  }, [primaryWallet?.address]);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">TARS DAO</h1>
            <p className="mt-2 text-sm text-gray-700">
              Vote on community proposals to release funds for verified social impact initiatives. {isMember ? `You are a member with ${memberStake} ETH staked.` : "You are not a member."}
            </p>
            <p className="mt-1 text-sm text-gray-500">
              Contract: <a href={`https://sepolia.arbiscan.io/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-500">{CONTRACT_ADDRESS}</a>
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Membership Actions */}
        {!isMember ? (
          <div className="mt-8 bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900">Join TARS DAO</h2>
            <p className="mt-2 text-sm text-gray-600">
              Stake 0.01 ETH to become a member and participate in voting for social impact initiatives.
            </p>
            <div className="mt-4">
              <button
                onClick={handleJoinDAO}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Join DAO'}
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-8 bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-medium text-gray-900">Member Status</h2>
                <p className="mt-2 text-sm text-gray-600">
                  Your stake: {memberStake} ETH
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  As a member, you can vote on proposals to release funds for verified social impact initiatives.
                </p>
              </div>
              <button
                onClick={handleLeaveDAO}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Leave DAO'}
              </button>
            </div>
          </div>
        )}

        {/* Proposals List */}
        <div className="mt-8 space-y-6">
          {loading && proposals.length === 0 ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-r-transparent"></div>
              <p className="mt-2 text-sm text-gray-500">Loading proposals...</p>
            </div>
          ) : proposals.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500">No active proposals found. Proposals are created automatically when high-impact initiatives are identified by our AI agents.</p>
            </div>
          ) : (
            proposals.map((proposal) => (
              <div
                key={proposal.id}
                className="bg-white shadow rounded-lg overflow-hidden"
              >
                <div className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-semibold text-gray-900">
                          {proposal.parsedData?.location}
                        </h2>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full
                          ${proposal.status === 'active' ? 'bg-green-100 text-green-800' :
                            proposal.status === 'passed' ? 'bg-blue-100 text-blue-800' :
                            'bg-red-100 text-red-800'}`}
                        >
                          {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
                        </span>
                      </div>
                      <div className="text-sm text-gray-500">
                        Impact Score: {proposal.parsedData?.impactScore} | Status: {proposal.parsedData?.verificationStatus}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div className="text-sm text-gray-700">
                      <p className="font-medium">Description:</p>
                      <p>{proposal.parsedData?.description}</p>
                    </div>
                    
                    <div className="text-sm text-gray-700">
                      <p className="font-medium">Verification Details:</p>
                      <p>{proposal.parsedData?.verificationDetails}</p>
                    </div>

                    <div className="text-sm text-gray-700">
                      <p className="font-medium">Proposed Action:</p>
                      <p>{proposal.parsedData?.proposedAction}</p>
                    </div>

                    <div className="text-sm text-gray-700">
                      <p className="font-medium">Evidence:</p>
                      <div className="ml-4">
                        <p>Media Analysis: <a href={proposal.parsedData?.evidence.mediaAnalysis} className="text-indigo-600 hover:text-indigo-500">{proposal.parsedData?.evidence.mediaAnalysis}</a></p>
                        <p>Verification Report: <a href={proposal.parsedData?.evidence.verificationReport} className="text-indigo-600 hover:text-indigo-500">{proposal.parsedData?.evidence.verificationReport}</a></p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-4 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">For:</span> {proposal.forVotes}
                    </div>
                    <div>
                      <span className="font-medium">Against:</span> {proposal.againstVotes}
                    </div>
                    <div>
                      <span className="font-medium">Deadline:</span> {new Date(proposal.deadline).toLocaleDateString()}
                    </div>
                    <div>
                      <span className="font-medium">Your Vote:</span> {proposal.hasVoted ? 'Voted' : 'Not voted'}
                    </div>
                  </div>
                  
                  {/* Voting Progress */}
                  <div className="mt-6">
                    <div className="mt-2 relative pt-1">
                      <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                        <div
                          style={{ width: `${(proposal.forVotes / (proposal.forVotes + proposal.againstVotes || 1)) * 100}%` }}
                          className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-green-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  {isMember && proposal.status === 'active' && !proposal.hasVoted && (
                    <div className="mt-6 flex gap-4">
                      <button
                        onClick={() => handleVote(proposal.id, true)}
                        disabled={loading}
                        className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                      >
                        {loading ? 'Processing...' : 'Vote For'}
                      </button>
                      <button
                        onClick={() => handleVote(proposal.id, false)}
                        disabled={loading}
                        className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                      >
                        {loading ? 'Processing...' : 'Vote Against'}
                      </button>
                    </div>
                  )}

                  {/* Execute Button */}
                  {isMember && proposal.status === 'passed' && !proposal.executed && (
                    <div className="mt-6">
                      <button
                        onClick={() => handleExecute(proposal.id)}
                        disabled={loading}
                        className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                      >
                        {loading ? 'Processing...' : 'Execute Proposal'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
} 