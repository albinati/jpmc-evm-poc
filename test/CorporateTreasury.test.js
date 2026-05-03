import { expect } from "chai";
import hre from "hardhat";

describe("CorporateTreasury", function () {
  async function deployTreasuryFixture(connection) {
    const { ethers } = connection;
    const [owner, operator, compliance, user1, user2, blacklisted] = await ethers.getSigners();

    const treasury = await ethers.deployContract("CorporateTreasury", [owner.address]);

    return { treasury, owner, operator, compliance, user1, user2, blacklisted };
  }

  it("should have correct initial supply", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { treasury, owner } = await networkHelpers.loadFixture(deployTreasuryFixture);

    const totalSupply = await treasury.totalSupply();
    const decimals = await treasury.decimals();
    const expected = BigInt(1_000_000_000) * BigInt(10) ** BigInt(decimals);

    expect(totalSupply).to.equal(expected);
    expect(await treasury.balanceOf(owner.address)).to.equal(expected);
  });

  it("should allow compliance to blacklist accounts", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { treasury, owner, user1 } = await networkHelpers.loadFixture(deployTreasuryFixture);

    await treasury.connect(owner).addToBlacklist(user1.address);
    expect(await treasury.isBlacklisted(user1.address)).to.be.true;
  });

  it("should block transfers from blacklisted accounts", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { treasury, owner, user1, user2 } = await networkHelpers.loadFixture(deployTreasuryFixture);

    await treasury.addToBlacklist(user1.address);

    await expect(treasury.connect(user1).transfer(user2.address, 100)).to.be.revertedWithCustomError(
      treasury,
      "BlacklistedAccount"
    );
  });

  it("should block transfers to blacklisted accounts", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { treasury, owner, user1, user2 } = await networkHelpers.loadFixture(deployTreasuryFixture);

    await treasury.addToBlacklist(user2.address);

    await expect(treasury.connect(user1).transfer(user2.address, 100)).to.be.revertedWithCustomError(
      treasury,
      "BlacklistedAccount"
    );
  });

  it("should allow compliance to freeze account", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { treasury, owner, user1 } = await networkHelpers.loadFixture(deployTreasuryFixture);

    await treasury.connect(owner).freezeAccount(user1.address, 30 * 24 * 60 * 60);

    const frozenUntil = await treasury.frozenUntil(user1.address);
    expect(frozenUntil).to.be.gt(0);
  });

  it("should block transfers from frozen accounts", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { treasury, owner, user1, user2 } = await networkHelpers.loadFixture(deployTreasuryFixture);

    await treasury.connect(owner).freezeAccount(user1.address, 30 * 24 * 60 * 60);

    await expect(treasury.connect(user1).transfer(user2.address, 100)).to.be.revertedWithCustomError(
      treasury,
      "AccountFrozen"
    );
  });

  it("should allow compliance to pause", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { treasury, owner, user1, user2 } = await networkHelpers.loadFixture(deployTreasuryFixture);

    await treasury.connect(owner).pause();

    await expect(treasury.connect(user1).transfer(user2.address, 100)).to.be.revertedWithCustomError(
      treasury,
      "EnforcedPause"
    );
  });

  it("should allow compliance to unpause", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { treasury, owner, user1, user2 } = await networkHelpers.loadFixture(deployTreasuryFixture);

    await treasury.pause();
    await treasury.unpause();

    await treasury.connect(owner).transfer(user1.address, 1000);
    expect(await treasury.balanceOf(user1.address)).to.equal(1000);
  });

  it("should allow treasury operator to mint", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { treasury, owner, user1 } = await networkHelpers.loadFixture(deployTreasuryFixture);

    await treasury.connect(owner).mint(user1.address, 10000);

    expect(await treasury.balanceOf(user1.address)).to.equal(10000);
  });

  it("should allow account to burn own tokens", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { treasury, owner, user1 } = await networkHelpers.loadFixture(deployTreasuryFixture);

    await treasury.transfer(user1.address, 1000);
    await treasury.connect(user1).burn(500);

    expect(await treasury.balanceOf(user1.address)).to.equal(500);
  });

  it("forceTransfer seizes from a blacklisted account and emits the seizure event", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { treasury, owner, user1, user2 } = await networkHelpers.loadFixture(deployTreasuryFixture);

    await treasury.transfer(user1.address, 5000);
    await treasury.connect(owner).addToBlacklist(user1.address);

    const reason = "0x" + Buffer.from("AML-2025-001".padEnd(32, "\0"), "utf8").toString("hex");

    await expect(
      treasury.connect(owner).forceTransfer(user1.address, user2.address, 1500, reason)
    )
      .to.emit(treasury, "ComplianceForceTransfer")
      .withArgs(user1.address, user2.address, 1500, reason, owner.address);

    expect(await treasury.balanceOf(user1.address)).to.equal(3500);
    expect(await treasury.balanceOf(user2.address)).to.equal(1500);
  });

  it("forceTransfer seizes from a frozen account", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { treasury, owner, user1, user2 } = await networkHelpers.loadFixture(deployTreasuryFixture);

    await treasury.transfer(user1.address, 5000);
    await treasury.connect(owner).freezeAccount(user1.address, 30 * 24 * 60 * 60);

    await treasury.connect(owner).forceTransfer(user1.address, user2.address, 2000, "0x" + "00".repeat(32));
    expect(await treasury.balanceOf(user2.address)).to.equal(2000);
  });

  it("forceTransfer reverts when paused", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { treasury, owner, user1, user2 } = await networkHelpers.loadFixture(deployTreasuryFixture);

    await treasury.transfer(user1.address, 5000);
    await treasury.connect(owner).pause();

    await expect(
      treasury.connect(owner).forceTransfer(user1.address, user2.address, 1000, "0x" + "00".repeat(32))
    ).to.be.revertedWithCustomError(treasury, "EnforcedPause");
  });

  it("forceTransfer requires COMPLIANCE_ROLE", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { treasury, owner, user1, user2 } = await networkHelpers.loadFixture(deployTreasuryFixture);

    await treasury.transfer(user1.address, 5000);

    await expect(
      treasury.connect(user2).forceTransfer(user1.address, user2.address, 1000, "0x" + "00".repeat(32))
    ).to.be.revertedWithCustomError(treasury, "AccessControlUnauthorizedAccount");
  });

  it("forceTransfer rejects zero address and self-seizure", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { treasury, owner, user1 } = await networkHelpers.loadFixture(deployTreasuryFixture);

    await treasury.transfer(user1.address, 5000);

    await expect(
      treasury.connect(owner).forceTransfer(user1.address, user1.address, 100, "0x" + "00".repeat(32))
    ).to.be.revertedWithCustomError(treasury, "InvalidSeizureParticipants");

    const ZERO = "0x" + "00".repeat(20);
    await expect(
      treasury.connect(owner).forceTransfer(ZERO, user1.address, 100, "0x" + "00".repeat(32))
    ).to.be.revertedWithCustomError(treasury, "InvalidSeizureParticipants");
  });

  it("post-seizure, normal transfer guards still apply", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { treasury, owner, user1, user2 } = await networkHelpers.loadFixture(deployTreasuryFixture);

    await treasury.transfer(user1.address, 5000);
    await treasury.connect(owner).addToBlacklist(user1.address);

    await treasury.connect(owner).forceTransfer(user1.address, user2.address, 1000, "0x" + "00".repeat(32));

    await expect(treasury.connect(user1).transfer(user2.address, 100)).to.be.revertedWithCustomError(
      treasury,
      "BlacklistedAccount"
    );
  });
});
