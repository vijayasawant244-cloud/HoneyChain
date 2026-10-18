import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();

  const HoneyBatch = await ethers.getContractFactory("HoneyBatch");
  const honeyBatch = await HoneyBatch.deploy();
  await honeyBatch.waitForDeployment();

  console.log("HoneyBatch deployed to:", await honeyBatch.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});