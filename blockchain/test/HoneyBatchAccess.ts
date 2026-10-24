import { expect } from "chai";
import { network } from "hardhat";

async function setup() {
  const { ethers } = await network.connect();
  const [owner, beekeeper, processor, distributor, outsider] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory("HoneyBatch");
  const c = await Factory.deploy();
  await c.waitForDeployment();
  await c.assignRole(beekeeper.address, 1);
  await c.assignRole(processor.address, 2);
  await c.assignRole(distributor.address, 3);
  return { c, owner, beekeeper, processor, distributor, outsider };
}

describe("HoneyBatch access control", function () {
  it("should set the deployer as owner", async function () {
    const { c, owner } = await setup();
    expect(await c.owner()).to.equal(owner.address);
  });

  it("should block a non-owner from setting health", async function () {
    const { c, beekeeper, outsider } = await setup();
    await c.connect(beekeeper).createBatch("HC020", "Raj", 1723500000, 20);
    await expect(
      c.connect(outsider).setHealth("HC020", "ideal", 95, 322)
    ).to.be.revertedWith("Only owner can do this");
  });

  it("should let the owner set health", async function () {
    const { c, beekeeper } = await setup();
    await c.connect(beekeeper).createBatch("HC021", "Meena", 1723500000, 30);
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
      c.connect(outsider).createBatch("HC030", "Fake", 1723500000, 10)
    ).to.be.revertedWith("Caller does not have the required role");
  });

  it("should block a processor from creating a batch", async function () {
    const { c, processor } = await setup();
    await expect(
      c.connect(processor).createBatch("HC031", "Fake", 1723500000, 10)
    ).to.be.revertedWith("Caller does not have the required role");
  });

  it("should block a beekeeper from marking Tested", async function () {
    const { c, beekeeper } = await setup();
    await c.connect(beekeeper).createBatch("HC032", "Raj", 1723500000, 10);
    await expect(
      c.connect(beekeeper).updateStatus("HC032", "Tested")
    ).to.be.revertedWith("Only Processor can mark Tested");
  });

  it("should not allow shipping before testing", async function () {
    const { c, beekeeper, distributor } = await setup();
    await c.connect(beekeeper).createBatch("HC033", "Raj", 1723500000, 10);
    await expect(
      c.connect(distributor).updateStatus("HC033", "Shipped")
    ).to.be.revertedWith("Batch must be Tested first");
  });

  it("should allow the full flow Harvested, Tested, Shipped", async function () {
    const { c, beekeeper, processor, distributor } = await setup();
    await c.connect(beekeeper).createBatch("HC034", "Meena", 1723500000, 10);
    await c.connect(processor).updateStatus("HC034", "Tested");
    await c.connect(distributor).updateStatus("HC034", "Shipped");

    const batch = await c.getBatch("HC034");
    expect(batch[4]).to.equal("Shipped");
  });

  it("should reject an invalid status", async function () {
    const { c, beekeeper, processor } = await setup();
    await c.connect(beekeeper).createBatch("HC035", "Raj", 1723500000, 10);
    await expect(
      c.connect(processor).updateStatus("HC035", "Banana")
    ).to.be.revertedWith("Invalid status");
  });
});