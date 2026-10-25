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

async function newBatch(c: any, beekeeper: any, id: string) {
  await c.connect(beekeeper).createBatch(id, "Raj", "HIVE-1", "Nashik", 1723500000, 10);
}

describe("HoneyBatch access control", function () {
  it("should set the deployer as owner", async function () {
    const { c, owner } = await setup();
    expect(await c.owner()).to.equal(owner.address);
  });

  it("should block a non-owner from setting health", async function () {
    const { c, beekeeper, outsider } = await setup();
    await newBatch(c, beekeeper, "HC020");
    await expect(
      c.connect(outsider).setHealth("HC020", "ideal", 95, 322)
    ).to.be.revertedWith("Only owner can do this");
  });

  it("should let the owner set health", async function () {
    const { c, beekeeper } = await setup();
    await newBatch(c, beekeeper, "HC021");
    await c.setHealth("HC021", "non_ideal", 90, 171);

    const h = await c.getHealth("HC021");
    expect(h[0]).to.equal("non_ideal");
  });

  it("should block a non-owner from assigning roles", async function () {
    const { c, outsider } = await setup();
    await expect(
      c.connect(outsider).assignRole(outsider.address, 1)
    ).to.be.revertedWith("Only owner can do this");
  });

  it("should block an address with no role from creating a batch", async function () {
    const { c, outsider } = await setup();
    await expect(
      c.connect(outsider).createBatch("HC030", "Fake", "HIVE-9", "Nowhere", 1723500000, 10)
    ).to.be.revertedWith("Caller does not have the required role");
  });

  it("should block a processor from creating a batch", async function () {
    const { c, processor } = await setup();
    await expect(
      c.connect(processor).createBatch("HC031", "Fake", "HIVE-9", "Nowhere", 1723500000, 10)
    ).to.be.revertedWith("Caller does not have the required role");
  });

  it("should block a beekeeper from marking Tested", async function () {
    const { c, beekeeper } = await setup();
    await newBatch(c, beekeeper, "HC032");
    await expect(
      c.connect(beekeeper).updateStatus("HC032", "Tested")
    ).to.be.revertedWith("Only Processor can mark Tested");
  });

  it("should not allow shipping before testing", async function () {
    const { c, beekeeper, distributor } = await setup();
    await newBatch(c, beekeeper, "HC033");
    await expect(
      c.connect(distributor).updateStatus("HC033", "Shipped")
    ).to.be.revertedWith("Batch must be Tested first");
  });

  it("should allow the full flow Harvested, Tested, Shipped", async function () {
    const { c, beekeeper, processor, distributor, lab } = await setup();
    await newBatch(c, beekeeper, "HC034");
    await c.connect(lab).recordLabReport("HC034", REPORT, true);
    await c.connect(processor).updateStatus("HC034", "Tested");
    await c.connect(distributor).updateStatus("HC034", "Shipped");

    const b = await c.getBatch("HC034");
    expect(b[6]).to.equal("Shipped");
  });

  it("should reject an invalid status", async function () {
    const { c, beekeeper, processor } = await setup();
    await newBatch(c, beekeeper, "HC035");
    await expect(
      c.connect(processor).updateStatus("HC035", "Banana")
    ).to.be.revertedWith("Invalid status");
  });

  it("should block an address with no role from recording a lab report", async function () {
    const { c, beekeeper, outsider } = await setup();
    await newBatch(c, beekeeper, "HC040");
    await expect(
      c.connect(outsider).recordLabReport("HC040", REPORT, true)
    ).to.be.revertedWith("Caller does not have the required role");
  });

  it("should block a beekeeper from recording a lab report", async function () {
    const { c, beekeeper } = await setup();
    await newBatch(c, beekeeper, "HC041");
    await expect(
      c.connect(beekeeper).recordLabReport("HC041", REPORT, true)
    ).to.be.revertedWith("Caller does not have the required role");
  });

  it("should reject a lab report for a non-existent batch", async function () {
    const { c, lab } = await setup();
    await expect(
      c.connect(lab).recordLabReport("FAKE999", REPORT, true)
    ).to.be.revertedWith("Batch does not exist");
  });

  it("should allow only one lab report per batch", async function () {
    const { c, beekeeper, lab } = await setup();
    await newBatch(c, beekeeper, "HC042");
    await c.connect(lab).recordLabReport("HC042", REPORT, false);
    await expect(
      c.connect(lab).recordLabReport("HC042", REPORT, true)
    ).to.be.revertedWith("Lab report already recorded");
  });

  it("should block Tested when no lab report exists", async function () {
    const { c, beekeeper, processor } = await setup();
    await newBatch(c, beekeeper, "HC043");
    await expect(
      c.connect(processor).updateStatus("HC043", "Tested")
    ).to.be.revertedWith("Lab report required");
  });

  it("should block Tested when the lab report did not pass", async function () {
    const { c, beekeeper, processor, lab } = await setup();
    await newBatch(c, beekeeper, "HC044");
    await c.connect(lab).recordLabReport("HC044", REPORT, false);
    await expect(
      c.connect(processor).updateStatus("HC044", "Tested")
    ).to.be.revertedWith("Lab report did not pass");
  });

  it("should store and read back a lab report", async function () {
    const { c, beekeeper, lab } = await setup();
    await newBatch(c, beekeeper, "HC045");
    await c.connect(lab).recordLabReport("HC045", REPORT, true);

    const r = await c.getLabReport("HC045");
    expect(r[0]).to.equal(lab.address);
    expect(r[1]).to.equal(REPORT);
    expect(r[2]).to.equal(true);
  });
});