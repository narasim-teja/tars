// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SimpleDAO {
    struct Proposal {
        string description;
        uint256 forVotes;
        uint256 againstVotes;
        uint256 deadline;
        bool executed;
        bool exists;
        mapping(address => bool) hasVoted;
    }

    mapping(bytes32 => Proposal) public proposals;
    mapping(address => bool) public members;
    mapping(address => uint256) public memberStakes;
    
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant QUORUM = 2; // Minimum votes required
    uint256 public constant MINIMUM_STAKE = 0.01 ether;

    event ProposalCreated(bytes32 indexed proposalId, string description, uint256 deadline);
    event Voted(bytes32 indexed proposalId, address indexed voter, bool support);
    event ProposalExecuted(bytes32 indexed proposalId);
    event MemberJoined(address indexed member, uint256 stake);
    event MemberLeft(address indexed member, uint256 stake);

    constructor() {
        // Pre-configure members
        members[0x526557EF4B43a83aE2bD93FCE1592f3fB4ca1D45] = true;
        members[0x300de2001FE0dA13B2aF275C9cAAFF847A2b7CEe] = true;
        members[0x97EE6Bd44AA73ad966e0BA80432D8C71230beAE2] = true;
        members[0x385eF658a56E4819039553AF2d675427d190F912] = true;
    }

    modifier onlyMember() {
        require(members[msg.sender], "Not a member");
        _;
    }

    // New function to join as a member
    function joinDAO() external payable {
        require(!members[msg.sender], "Already a member");
        require(msg.value >= MINIMUM_STAKE, "Insufficient stake");
        
        members[msg.sender] = true;
        memberStakes[msg.sender] = msg.value;
        
        emit MemberJoined(msg.sender, msg.value);
    }

    // New function to leave the DAO and withdraw stake
    function leaveDAO() external onlyMember {
        require(memberStakes[msg.sender] > 0, "No stake to withdraw");
        
        uint256 stake = memberStakes[msg.sender];
        members[msg.sender] = false;
        memberStakes[msg.sender] = 0;
        
        // Check if there are any active proposals
        require(!hasActiveProposals(), "Cannot leave while proposals are active");
        
        emit MemberLeft(msg.sender, stake);
        
        // Transfer stake back to member
        (bool success, ) = payable(msg.sender).call{value: stake}("");
        require(success, "Transfer failed");
    }

    // Helper function to check for active proposals
    function hasActiveProposals() internal view returns (bool) {
        // Implementation can be enhanced based on specific requirements
        return false;
    }

    function createProposal(string calldata description) external onlyMember returns (bytes32) {
        bytes32 proposalId = keccak256(abi.encodePacked(description, block.timestamp, msg.sender));
        
        Proposal storage proposal = proposals[proposalId];
        require(!proposal.exists, "Proposal already exists");
        
        proposal.description = description;
        proposal.deadline = block.timestamp + VOTING_PERIOD;
        proposal.exists = true;
        
        emit ProposalCreated(proposalId, description, proposal.deadline);
        return proposalId;
    }

    function vote(bytes32 proposalId, bool support) external onlyMember {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.exists, "Proposal doesn't exist");
        require(block.timestamp <= proposal.deadline, "Voting period ended");
        require(!proposal.hasVoted[msg.sender], "Already voted");
        
        proposal.hasVoted[msg.sender] = true;
        if (support) {
            proposal.forVotes += 1;
        } else {
            proposal.againstVotes += 1;
        }
        
        emit Voted(proposalId, msg.sender, support);
    }

    function executeProposal(bytes32 proposalId) external onlyMember {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.exists, "Proposal doesn't exist");
        require(!proposal.executed, "Already executed");
        require(block.timestamp > proposal.deadline, "Voting still in progress");
        require(proposal.forVotes + proposal.againstVotes >= QUORUM, "Quorum not reached");
        require(proposal.forVotes > proposal.againstVotes, "Proposal rejected");
        
        proposal.executed = true;
        emit ProposalExecuted(proposalId);
    }

    function getProposal(bytes32 proposalId) external view returns (
        string memory description,
        uint256 forVotes,
        uint256 againstVotes,
        uint256 deadline,
        bool executed,
        bool exists
    ) {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.description,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.deadline,
            proposal.executed,
            proposal.exists
        );
    }

    function hasVoted(bytes32 proposalId, address voter) external view returns (bool) {
        return proposals[proposalId].hasVoted[voter];
    }

    function isMember(address account) external view returns (bool) {
        return members[account];
    }

    // View function to get member's stake
    function getMemberStake(address member) external view returns (uint256) {
        return memberStakes[member];
    }
} 