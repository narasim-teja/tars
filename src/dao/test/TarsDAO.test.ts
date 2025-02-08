import { expect } from "chai";
import { ethers } from "hardhat";
import { TarsDAO } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("TarsDAO", function () {
  let dao: TarsDAO;
  let owner: HardhatEthersSigner;
  let verifier: HardhatEthersSigner;
  let agent: HardhatEthersSigner;
  let beneficiary: HardhatEthersSigner;

  beforeEach(async function () {
    [owner, verifier, agent, beneficiary] = await ethers.getSigners();

    const TarsDAO = await ethers.getContractFactory("TarsDAO");
    dao = await TarsDAO.deploy();
  });

  describe("Roles", function () {
    it("Should allow joining as verifier", async function () {
      const stakeAmount = await dao.MINIMUM_STAKE();
      await dao.connect(verifier).joinAsVerifier({ value: stakeAmount });
      
      expect(await dao.hasRole(await dao.VERIFIER_ROLE(), verifier.address)).to.be.true;
      expect(await dao.balanceOf(verifier.address)).to.equal(stakeAmount);
    });

    it("Should allow joining as agent", async function () {
      await dao.connect(agent).joinAsAgent();
      
      expect(await dao.hasRole(await dao.AGENT_ROLE(), agent.address)).to.be.true;
      expect(await dao.balanceOf(agent.address)).to.equal((await dao.MINIMUM_STAKE()) / 2n);
    });
  });

  describe("Cause Creation and Voting", function () {
    const imageHash = ethers.keccak256(ethers.toUtf8Bytes("test image"));
    const description = "Test cause";
    const requestedAmount = ethers.parseEther("0.1");

    beforeEach(async function () {
      // Setup verifier and agent
      const stakeAmount = await dao.MINIMUM_STAKE();
      await dao.connect(verifier).joinAsVerifier({ value: stakeAmount });
      await dao.connect(agent).joinAsAgent();
    });

    it("Should allow creating a cause", async function () {
      await dao.connect(verifier).createCause(
        imageHash,
        description,
        requestedAmount,
        beneficiary.address
      );

      const causeId = ethers.keccak256(
        ethers.solidityPacked(
          ['bytes32', 'uint256'],
          [imageHash, await ethers.provider.getBlock('latest').then(b => b!.timestamp)]
        )
      );

      // Verify cause exists
      const cause = await dao.causes(causeId);
      expect(cause.exists).to.be.true;
      expect(cause.imageHash).to.equal(imageHash);
    });

    it("Should allow verifying and voting on a cause", async function () {
      // Create cause
      const tx = await dao.connect(verifier).createCause(
        imageHash,
        description,
        requestedAmount,
        beneficiary.address
      );
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);
      
      const causeId = ethers.keccak256(
        ethers.solidityPacked(
          ['bytes32', 'uint256'],
          [imageHash, block!.timestamp]
        )
      );

      // Verify cause
      await dao.connect(verifier).verifyCause(causeId);

      // Get more verifiers
      const [, , verifier2, verifier3] = await ethers.getSigners();
      const stakeAmount = await dao.MINIMUM_STAKE();
      await dao.connect(verifier2).joinAsVerifier({ value: stakeAmount });
      await dao.connect(verifier3).joinAsVerifier({ value: stakeAmount });

      // Get verifications
      await dao.connect(verifier2).verifyCause(causeId);
      await dao.connect(verifier3).verifyCause(causeId);

      // Vote
      await dao.connect(verifier).vote(causeId, true);
      await dao.connect(verifier2).vote(causeId, true);
      await dao.connect(verifier3).vote(causeId, false);

      const cause = await dao.causes(causeId);
      expect(cause.verificationCount).to.equal(3);
      expect(cause.approvalCount).to.be.gt(cause.disapprovalCount);
    });

    it("Should execute approved cause", async function () {
      // Create and verify cause
      await dao.connect(verifier).createCause(
        imageHash,
        description,
        requestedAmount,
        beneficiary.address
      );

      const tx = await dao.connect(verifier).createCause(
        imageHash,
        description,
        requestedAmount,
        beneficiary.address
      );
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);
      
      const causeId = ethers.keccak256(
        ethers.solidityPacked(
          ['bytes32', 'uint256'],
          [imageHash, block!.timestamp]
        )
      );

      // Get verifications
      const [, , verifier2, verifier3] = await ethers.getSigners();
      const stakeAmount = await dao.MINIMUM_STAKE();
      await dao.connect(verifier2).joinAsVerifier({ value: stakeAmount });
      await dao.connect(verifier3).joinAsVerifier({ value: stakeAmount });

      await dao.connect(verifier).verifyCause(causeId);
      await dao.connect(verifier2).verifyCause(causeId);
      await dao.connect(verifier3).verifyCause(causeId);

      // Vote
      await dao.connect(verifier).vote(causeId, true);
      await dao.connect(verifier2).vote(causeId, true);
      await dao.connect(verifier3).vote(causeId, true);

      // Wait for voting period
      await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]); // 3 days
      await ethers.provider.send("evm_mine", []);

      // Fund DAO
      await owner.sendTransaction({
        to: await dao.getAddress(),
        value: ethers.parseEther("1")
      });

      // Execute
      const initialBalance = await ethers.provider.getBalance(beneficiary.address);
      await dao.connect(owner).executeCause(causeId);
      const finalBalance = await ethers.provider.getBalance(beneficiary.address);

      expect(finalBalance - initialBalance).to.equal(requestedAmount);
    });
  });
}); 