import { expect } from "chai";
import { network } from "hardhat";

describe("HoneyBatch access control", function () {
  it("should set the deployer as owner", async function () {
    const { ethers } = await network.connect();
    const [owner] = await ethers.getSigners();
    const HoneyBatch = await ethers.getContractFactory("HoneyBatch");
    const honeyBatch = await HoneyBatch.deploy();
    await honeyBatch.waitForDeployment();

    expect(await honeyBatch.owner()).to.equal(owner.address);
  });

  it("should block a non-owner from setting health", async function () {
    const { ethers } = await network.connect();
    const [, other] = await ethers.getSigners();
    const HoneyBatch = await ethers.getContractFactory("HoneyBatch");
    const honeyBatch = await HoneyBatch.deploy();
    await honeyBatch.waitForDeployment();

    await honeyBatch.createBatch("HC020", "Raj", 1723500000, 20);
    await expect(
      honeyBatch.connect(other).setHealth("HC020", "ideal", 95, 322)
    ).to.be.revertedWith("Only owner can do this");
  });

  it("should let the owner set health", async function () {
    const { ethers } = await network.connect();
    const HoneyBatch = await ethers.getContractFactory("HoneyBatch");
    const honeyBatch = await HoneyBatch.deploy();
    await honeyBatch.waitForDeployment();

    await honeyBatch.createBatch("HC021", "Meena", 1723500000, 30);
    await honeyBatch.setHealth("HC021", "non_ideal", 90, 171);

    const h = await honeyBatch.getHealth("HC021");
    expect(h[0]).to.equal("non_ideal");
  });
});