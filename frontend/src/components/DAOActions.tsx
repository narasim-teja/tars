import { useState } from 'react';


interface DAOActionsProps {
  contractAddress: string;
}

export default function DAOActions({ contractAddress }: DAOActionsProps) {
  const [amount, setAmount] = useState('');
  const [proposal, setProposal] = useState('');

  const handleVote = async (support: boolean) => {
    try {
      // TODO: Implement voting logic using ethers.js
      console.log('Voting:', support ? 'For' : 'Against', 'Proposal:', proposal);
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const handleTransfer = async () => {
    try {
      // TODO: Implement transfer logic using ethers.js
      console.log('Transferring:', amount, 'to:', contractAddress);
    } catch (error) {
      console.error('Error transferring funds:', error);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">DAO Contract Actions</h2>
        <p className="mt-1 text-sm text-gray-600">
          Contract deployed at: {contractAddress}
        </p>
      </div>

      {/* Voting Section */}
      <div className="space-y-4">
        <div>
          <label htmlFor="proposal" className="block text-sm font-medium text-gray-700">
            Proposal
          </label>
          <textarea
            id="proposal"
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="Enter proposal details..."
            value={proposal}
            onChange={(e) => setProposal(e.target.value)}
          />
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => handleVote(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          >
            Vote For
          </button>
          <button
            onClick={() => handleVote(false)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Vote Against
          </button>
        </div>
      </div>

      {/* Transfer Section */}
      <div className="space-y-4 pt-6 border-t border-gray-200">
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
            Amount (ETH)
          </label>
          <div className="mt-1 relative rounded-md shadow-sm">
            <input
              type="number"
              id="amount"
              className="block w-full rounded-md border-gray-300 pl-3 pr-12 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="0.0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <span className="text-gray-500 sm:text-sm">ETH</span>
            </div>
          </div>
        </div>
        <button
          onClick={handleTransfer}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Transfer Funds
        </button>
      </div>
    </div>
  );
} 