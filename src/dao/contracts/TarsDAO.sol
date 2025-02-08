// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract TarsDAO is ERC20, AccessControl, ReentrancyGuard {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant AGENT_ROLE = keccak256("AGENT_ROLE");
    
    uint256 public constant MINIMUM_STAKE = 100 * 10**18; // 100 tokens
    uint256 public constant VERIFICATION_THRESHOLD = 3; // Number of verifications needed
    uint256 public constant VOTING_PERIOD = 3 days;
    
    struct Cause {
        bytes32 imageHash;
        string description;
        uint256 requestedAmount;
        address payable beneficiary;
        uint256 verificationCount;
        uint256 approvalCount;
        uint256 disapprovalCount;
        uint256 deadline;
        bool executed;
        bool exists;
        mapping(address => bool) hasVerified;
        mapping(address => bool) hasVoted;
    }
    
    mapping(bytes32 => Cause) public causes;
    mapping(address => uint256) public stakedAmount;
    
    event CauseCreated(bytes32 indexed causeId, bytes32 imageHash, string description, uint256 requestedAmount);
    event CauseVerified(bytes32 indexed causeId, address verifier);
    event VoteCast(bytes32 indexed causeId, address voter, bool support);
    event CauseExecuted(bytes32 indexed causeId, uint256 amount);
    event VerifierJoined(address verifier);
    event AgentJoined(address agent);

    constructor() ERC20("TARS Governance", "TARS") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        // Mint initial supply to DAO
        _mint(address(this), 1000000 * 10**18);
    }

    function joinAsVerifier() external payable {
        require(!hasRole(VERIFIER_ROLE, msg.sender), "Already a verifier");
        require(msg.value >= MINIMUM_STAKE, "Insufficient stake");
        
        _grantRole(VERIFIER_ROLE, msg.sender);
        stakedAmount[msg.sender] = msg.value;
        
        // Transfer governance tokens to verifier
        _transfer(address(this), msg.sender, MINIMUM_STAKE);
        
        emit VerifierJoined(msg.sender);
    }

    function joinAsAgent() external {
        require(!hasRole(AGENT_ROLE, msg.sender), "Already an agent");
        _grantRole(AGENT_ROLE, msg.sender);
        
        // Transfer initial tokens to agent
        _transfer(address(this), msg.sender, MINIMUM_STAKE / 2);
        
        emit AgentJoined(msg.sender);
    }

    function createCause(
        bytes32 imageHash,
        string calldata description,
        uint256 requestedAmount,
        address payable beneficiary
    ) external {
        require(hasRole(VERIFIER_ROLE, msg.sender) || hasRole(AGENT_ROLE, msg.sender), "Not authorized");
        
        bytes32 causeId = keccak256(abi.encodePacked(imageHash, block.timestamp));
        require(!causes[causeId].exists, "Cause already exists");
        
        Cause storage newCause = causes[causeId];
        newCause.imageHash = imageHash;
        newCause.description = description;
        newCause.requestedAmount = requestedAmount;
        newCause.beneficiary = beneficiary;
        newCause.deadline = block.timestamp + VOTING_PERIOD;
        newCause.exists = true;
        
        emit CauseCreated(causeId, imageHash, description, requestedAmount);
    }

    function verifyCause(bytes32 causeId) external {
        require(hasRole(VERIFIER_ROLE, msg.sender), "Not a verifier");
        Cause storage cause = causes[causeId];
        require(cause.exists, "Cause doesn't exist");
        require(!cause.hasVerified[msg.sender], "Already verified");
        require(block.timestamp < cause.deadline, "Voting period ended");
        
        cause.hasVerified[msg.sender] = true;
        cause.verificationCount++;
        
        emit CauseVerified(causeId, msg.sender);
    }

    function vote(bytes32 causeId, bool support) external {
        require(hasRole(VERIFIER_ROLE, msg.sender) || hasRole(AGENT_ROLE, msg.sender), "Not authorized");
        Cause storage cause = causes[causeId];
        require(cause.exists, "Cause doesn't exist");
        require(!cause.hasVoted[msg.sender], "Already voted");
        require(block.timestamp < cause.deadline, "Voting period ended");
        require(cause.verificationCount >= VERIFICATION_THRESHOLD, "Not enough verifications");
        
        cause.hasVoted[msg.sender] = true;
        if (support) {
            cause.approvalCount += balanceOf(msg.sender);
        } else {
            cause.disapprovalCount += balanceOf(msg.sender);
        }
        
        emit VoteCast(causeId, msg.sender, support);
    }

    function executeCause(bytes32 causeId) external nonReentrant {
        Cause storage cause = causes[causeId];
        require(cause.exists, "Cause doesn't exist");
        require(!cause.executed, "Already executed");
        require(block.timestamp >= cause.deadline, "Voting still ongoing");
        require(cause.verificationCount >= VERIFICATION_THRESHOLD, "Not enough verifications");
        require(cause.approvalCount > cause.disapprovalCount, "Vote not passed");
        require(address(this).balance >= cause.requestedAmount, "Insufficient DAO balance");
        
        cause.executed = true;
        (bool success, ) = cause.beneficiary.call{value: cause.requestedAmount}("");
        require(success, "Transfer failed");
        
        emit CauseExecuted(causeId, cause.requestedAmount);
    }

    // Allow DAO to receive ETH
    receive() external payable {}
} 