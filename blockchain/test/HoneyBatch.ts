import { expect } from "chai";
import { network } from "hardhat";

describe("HoneyBatch", function () {
  it("should create and retrieve a honey batch", async function () {
    const { ethers } = await network.connect();
    const HoneyBatch = await ethers.getContractFactory("HoneyBatch");
    const honeyBatch = await HoneyBatch.deploy();
    await honeyBatch.waitForDeployment();

    await honeyBatch.createBatch("HC001", "Vijaya", 1723500000, 50);
    const batch = await honeyBatch.getBatch("HC001");

    expect(batch[0]).to.equal("HC001");
    expect(batch[1]).to.equal("Vijaya");
    expect(batch[3]).to.equal(50n);
    expect(batch[4]).to.equal("Harvested");
  });

  it("should update the status of an existing batch", async function () {
    const { ethers } = await network.connect();
    const HoneyBatch = await ethers.getContractFactory("HoneyBatch");
    const honeyBatch = await HoneyBatch.deploy();
    await honeyBatch.waitForDeployment();

    await honeyBatch.createBatch("HC002", "Raj", 1723500000, 30);
    await honeyBatch.updateStatus("HC002", "Tested");

    const batch = await honeyBatch.getBatch("HC002");
    expect(batch[4]).to.equal("Tested");
  });

  it("should fail when updating a non-existent batch", async function () {
    const { ethers } = await network.connect();
    const HoneyBatch = await ethers.getContractFactory("HoneyBatch");
    const honeyBatch = await HoneyBatch.deploy();
    await honeyBatch.waitForDeployment();

    await expect(
      honeyBatch.updateStatus("FAKE999", "Tested")
    ).to.be.revertedWith("Batch does not exist");
  });

  it("should return all batch IDs", async function () {
    const { ethers } = await network.connect();
    const HoneyBatch = await ethers.getContractFactory("HoneyBatch");
    const honeyBatch = await HoneyBatch.deploy();
    await honeyBatch.waitForDeployment();

    await honeyBatch.createBatch("HC003", "Meena", 1723500000, 40);
    await honeyBatch.createBatch("HC004", "Sunil", 1723500000, 25);

    const ids = await honeyBatch.getAllBatchIds();
    expect(ids).to.deep.equal(["HC003", "HC004"]);
  });

  it("should store and read a health record", async function () {
    const { ethers } = await network.connect();
    const HoneyBatch = await ethers.getContractFactory("HoneyBatch");
    const honeyBatch = await HoneyBatch.deploy();
    await honeyBatch.waitForDeployment();

    await honeyBatch.createBatch("HC010", "Vijaya", 1723500000, 40);
    await honeyBatch.setHealth("HC010", "ideal", 95, 322);

    const h = await honeyBatch.getHealth("HC010");
    expect(h[0]).to.equal("ideal");
    expect(h[1]).to.equal(95n);
    expect(h[2]).to.equal(322n);
  });

  it("should reject health data for a non-existent batch", async function () {
    const { ethers } = await network.connect();
    const HoneyBatch = await ethers.getContractFactory("HoneyBatch");
    const honeyBatch = await HoneyBatch.deploy();
    await honeyBatch.waitForDeployment();

    await expect(
      honeyBatch.setHealth("FAKE999", "ideal", 95, 322)
    ).to.be.revertedWith("Batch does not exist");
  });

  it("should reject a confidence above 100", async function () {
    const { ethers } = await network.connect();
    const HoneyBatch = await ethers.getContractFactory("HoneyBatch");
    const honeyBatch = await HoneyBatch.deploy();
    await honeyBatch.waitForDeployment();

    await honeyBatch.createBatch("HC011", "Raj", 1723500000, 20);
    await expect(
      honeyBatch.setHealth("HC011", "ideal", 150, 322)
    ).to.be.revertedWith("Confidence must be 0-100");
  });
});