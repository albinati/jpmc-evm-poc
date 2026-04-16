const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/fixtures");
const { ethers } = require("hardhat");

describe("CorporateTreasury", function () {
  async function deployTreasuryFixture() {
    const [owner, operator, compliance, user1, user2, blacklisted] = await ethers.getSigners();

    const CorporateTreasury = await ethers.getContractFactory("CorporateTreasury");
    const treasury = await CorporateTreasury.deploy(owner.address);

    return { treasury, owner, operator, compliance, user1, user2, blacklisted };
  }

  describe("Initial Supply", function () {
    it("should have correct initial supply", async function () {
      const { treasury, owner } = await loadFixture(deployTreasuryFixture);

      const totalSupply = await treasury.totalSupply();
      const decimals = await treasury.decimals();
      const expected = BigInt(1_000_000_000) * BigInt(10) ** BigInt(decimals);

      expect(totalSupply).to.equal(expected);
      expect(await treasury.balanceOf(owner.address)).to.equal(expected);
    });
  });

  describe("Blacklist", function () {
    it("should allow compliance to blacklist accounts", async function () {
      const { treasury, owner, compliance, user1 } = await loadFixture(
        deployTreasuryFixture
      );

      await treasury.connect(owner).addToBlacklist(user1.address);
      expect(await treasury.isBlacklisted(user1.address)).to.be.true;
    });

    it("should block transfers from blacklisted accounts", async function () {
      const { treasury, owner, user1, user2 } = await loadFixture(
        deployTreasuryFixture
      );

      await treasury.addToBlacklist(user1.address);

      await expect(
        treasury.connect(user1).transfer(user2.address, 100)
      ).to.be.revertedWithCustomError(treasury, "BlacklistedAccount");
    });

    it("should block transfers to blacklisted accounts", async function () {
      const { treasury, owner, user1, user2 } = await loadFixture(
        deployTreasuryFixture
      );

      await treasury.addToBlacklist(user2.address);

      await expect(
        treasury.connect(user1).transfer(user2.address, 100)
      ).to.be.revertedWithCustomError(treasury, "BlacklistedAccount");
    });
  });

  describe("Freeze", function () {
    it("should allow compliance to freeze account", async function () {
      const { treasury, owner, compliance, user1 } = await loadFixture(
        deployTreasuryFixture
      );

      await treasury.connect(owner).freezeAccount(user1.address, 30 * 24 * 60 * 60);

      const frozenUntil = await treasury.frozenUntil(user1.address);
      expect(frozenUntil).to.be.gt(0);
    });

    it("should block transfers from frozen accounts", async function () {
      const { treasury, owner, user1, user2 } = await loadFixture(
        deployTreasuryFixture
      );

      await treasury.connect(owner).freezeAccount(user1.address, 30 * 24 * 60 * 60);

      await expect(
        treasury.connect(user1).transfer(user2.address, 100)
      ).to.be.revertedWithCustomError(treasury, "AccountFrozen");
    });
  });

  describe("Pausable", function () {
    it("should allow compliance to pause", async function () {
      const { treasury, owner, compliance, user1, user2 } = await loadFixture(
        deployTreasuryFixture
      );

      await treasury.connect(owner).pause();

      await expect(
        treasury.connect(user1).transfer(user2.address, 100)
      ).to.be.revertedWith("Pausable: paused");
    });

    it("should allow compliance to unpause", async function () {
      const { treasury, owner, user1, user2 } = await loadFixture(
        deployTreasuryFixture
      );

      await treasury.pause();
      await treasury.unpause();

      await treasury.connect(owner).transfer(user1.address, 1000);
      expect(await treasury.balanceOf(user1.address)).to.equal(1000);
    });
  });

  describe("Minting", function () {
    it("should allow treasury operator to mint", async function () {
      const { treasury, owner, operator, user1 } = await loadFixture(
        deployTreasuryFixture
      );

      await treasury.connect(owner).mint(user1.address, 10000);

      expect(await treasury.balanceOf(user1.address)).to.equal(10000);
    });
  });

  describe("Burning", function () {
    it("should allow account to burn own tokens", async function () {
      const { treasury, owner, user1 } = await loadFixture(deployTreasuryFixture);

      await treasury.transfer(user1.address, 1000);
      await treasury.connect(user1).burn(500);

      expect(await treasury.balanceOf(user1.address)).to.equal(500);
    });
  });
});