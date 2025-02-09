import hre from "hardhat";

async function main() {
  console.log("Deploying TarsDAO...");

  const TarsDAO = await hre.ethers.getContractFactory("SimpleDAO");
  const dao = await TarsDAO.deploy();
  await dao.waitForDeployment();

  console.log("TarsDAO deployed to:", await dao.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}); 