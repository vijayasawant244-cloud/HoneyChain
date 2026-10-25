import { expect } from "chai";
import { network } from "hardhat";

const REPORT = "0x" + "ab".repeat(32);

async function setup() {
  const { ethers } = await network.connect();
  const [owner, beekeeper, processor, distributor, lab, outsider] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory("HoneyBatch");
  const c = await Factory.deploy();
  await c.waitForDeployment();
  await c.assignRole(beekeeper.address, 1);
  await c.assignRole(processor.address, 2);
  await c.assignRole(distributor.address, 3);
  await c.assignRole(lab.address, 4);
  return { c, owner, beekeeper, processor, distributor, lab, outsider };
}

describe("HoneyBatch", function () {
  it("should create and retrieve a honey batch", async function () {
    const { c, beekeeper } = await setup();
    await c.connect(beekeeper).createBatch("HC001", "Vijaya", "HIVE-1", "Nashik", 1723500000, 50);
    const b = await c.getBatch("HC001");

    expect(b[0]).to.equal("HC001");
    expect(b[1]).to.equal("Vijaya");
    expect(b[2]).to.equal("HIVE-1");
    expect(b[3]).to.equal("Nashik");
    expect(b[5]).to.equal(50n);
    expect(b[6]).to.equal("Harvested");
  });

  it("should let a processor mark a batch Tested after a passing lab report", async function () {
    const { c, beekeeper, processor, lab } = await setup();
    await c.connect(beekeeper).createBatch("HC002", "Raj", "HIVE-2", "Pune", 1723500000, 30);
    await c.connect(lab).recordLabReport("HC002", REPORT, true);
    await c.connect(processor).updateStatus("HC002", "Tested");

    const b = await c.getBatch("HC002");
    expect(b[6]).to.equal("Tested");
  });

  it("should fail when updating a non-existent batch", async function () {
    const { c, processor } = await setup();
    await expect(
      c.connect(processor).updateStatus("FAKE999", "Tested")
    ).to.be.revertedWith("Batch does not exist");
  });

  it("should return all batch IDs", async function () {
    const { c, beekeeper } = await setup();
    await c.connect(beekeeper).createBatch("HC003", "Meena", "HIVE-3", "Nashik", 1723500000, 40);
    await c.connect(beekeeper).createBatch("HC004", "Sunil", "HIVE-4", "Satara", 1723500000, 25);

    const ids = await c.getAllBatchIds();
    expect(ids).to.deep.equal(["HC003", "HC004"]);
  });

  it("should store and read a health record", async function () {
    const { c, beekeeper } = await setup();
    await c.connect(beekeeper).createBatch("HC010", "Vijaya", "HIVE-1", "Nashik", 1723500000, 40);
    await c.setHealth("HC010", "ideal", 95, 322);

    const h = await c.getHealth("HC010");
    expect(h[0]).to.equal("ideal");
    expect(h[1]).to.equal(95n);
    expect(h[2]).to.equal(322n);
  });

  it("should reject health data for a non-existent batch", async function () {
    const { c } = await setup();
    await expect(
      c.setHealth("FAKE999", "ideal", 95, 322)
    ).to.be.revertedWith("Batch does not exist");
  });

  it("should reject a confidence above 100", async function () {
    const { c, beekeeper } = await setup();
    await c.connect(beekeeper).createBatch("HC011", "Raj", "HIVE-1", "Nashik", 1723500000, 20);
    await expect(
      c.setHealth("HC011", "ideal", 150, 322)
    ).to.be.revertedWith("Confidence must be 0-100");
  });

  it("should reject a duplicate batch ID", async function () {
    const { c, beekeeper } = await setup();
    await c.connect(beekeeper).createBatch("HC012", "Raj", "HIVE-1", "Nashik", 1723500000, 20);
    await expect(
      c.connect(beekeeper).createBatch("HC012", "Raj", "HIVE-1", "Nashik", 1723500000, 20)
    ).to.be.revertedWith("Batch ID already exists");
  });

  it("should reject an empty batch ID", async function () {
    const { c, beekeeper } = await setup();
    await expect(
      c.connect(beekeeper).createBatch("", "Raj", "HIVE-1", "Nashik", 1723500000, 20)
    ).to.be.revertedWith("Batch ID required");
  });
});