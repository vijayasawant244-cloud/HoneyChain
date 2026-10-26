import { expect } from "chai";
import { network } from "hardhat";

async function setup() {
  const { ethers } = await network.connect();
  const [owner, beekeeper, otherBeekeeper, outsider, consumer] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory("HoneyBatch");
  const c = await Factory.deploy();
  await c.waitForDeployment();
  await c.assignRole(beekeeper.address, 1);
  await c.assignRole(otherBeekeeper.address, 1);
  await c.connect(beekeeper).createBatch("HC200", "Vijaya", "HIVE-1", "Nashik", 1723500000, 20);
  const hash = (s: string) => ethers.keccak256(ethers.toUtf8Bytes(s));
  return { c, owner, beekeeper, otherBeekeeper, outsider, consumer, hash };
}

describe("HoneyBatch jar codes", function () {
  it("should let the batch creator register jar codes", async function () {
    const { c, beekeeper, hash } = await setup();
    await c.connect(beekeeper).registerJars("HC200", [hash("AAAA-1111"), hash("BBBB-2222")]);
    expect(await c.jarCount("HC200")).to.equal(2n);
  });

  it("should block another beekeeper from registering codes for this batch", async function () {
    const { c, otherBeekeeper, hash } = await setup();
    await expect(
      c.connect(otherBeekeeper).registerJars("HC200", [hash("CCCC-3333")])
    ).to.be.revertedWith("Only the batch creator can do this");
  });

  it("should block an address with no role from registering codes", async function () {
    const { c, outsider, hash } = await setup();
    await expect(
      c.connect(outsider).registerJars("HC200", [hash("DDDD-4444")])
    ).to.be.revertedWith("Caller does not have the required role");
  });

  it("should reject codes for a non-existent batch", async function () {
    const { c, beekeeper, hash } = await setup();
    await expect(
      c.connect(beekeeper).registerJars("FAKE999", [hash("EEEE-5555")])
    ).to.be.revertedWith("Batch does not exist");
  });

  it("should reject an empty list of codes", async function () {
    const { c, beekeeper } = await setup();
    await expect(
      c.connect(beekeeper).registerJars("HC200", [])
    ).to.be.revertedWith("No codes given");
  });

  it("should reject a code that is already registered", async function () {
    const { c, beekeeper, hash } = await setup();
    await c.connect(beekeeper).registerJars("HC200", [hash("FFFF-6666")]);
    await expect(
      c.connect(beekeeper).registerJars("HC200", [hash("FFFF-6666")])
    ).to.be.revertedWith("Code already registered");
  });

  it("should report a registered, unused code correctly", async function () {
    const { c, beekeeper, hash } = await setup();
    await c.connect(beekeeper).registerJars("HC200", [hash("GGGG-7777")]);
    const s = await c.getJarStatus("GGGG-7777");
    expect(s[0]).to.equal(true);
    expect(s[1]).to.equal(false);
    expect(s[3]).to.equal("HC200");
  });

  it("should mark a code as used the first time it is claimed", async function () {
    const { c, beekeeper, consumer, hash } = await setup();
    await c.connect(beekeeper).registerJars("HC200", [hash("HHHH-8888")]);
    await c.connect(consumer).claimJar("HHHH-8888");

    const s = await c.getJarStatus("HHHH-8888");
    expect(s[1]).to.equal(true);
    expect(await c.claimedCount("HC200")).to.equal(1n);
  });

  it("should reject a second claim of the same code", async function () {
    const { c, beekeeper, consumer, hash } = await setup();
    await c.connect(beekeeper).registerJars("HC200", [hash("JJJJ-9999")]);
    await c.connect(consumer).claimJar("JJJJ-9999");
    await expect(
      c.connect(consumer).claimJar("JJJJ-9999")
    ).to.be.revertedWith("Code already used");
  });

  it("should reject an unknown code", async function () {
    const { c, consumer } = await setup();
    await expect(
      c.connect(consumer).claimJar("NOPE-0000")
    ).to.be.revertedWith("Unknown code");
  });
});