const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/fixtures");
const { ethers } = require("hardhat");

describe("TitleTokenization", function () {
  async function deployTitleFixture() {
    const [owner, complianceOfficer, buyer, seller, unauthorized] = await ethers.getSigners();

    const TitleTokenization = await ethers.getContractFactory("TitleTokenization");
    const title = await TitleTokenization.deploy(owner.address);

    return { title, owner, complianceOfficer, buyer, seller, unauthorized };
  }

  describe("Minting", function () {
    it("should allow compliance officer to mint title", async function () {
      const { title, owner, complianceOfficer } = await loadFixture(deployTitleFixture);

      await title.mintTitle(
        owner.address,
        1,
        "https://jpmc.title/1",
        "0x1234567890123456789012345678901234567890",
        500000,
        "NY"
      );

      expect(await title.ownerOf(1)).to.equal(owner.address);
    });

    it("should store title details", async function () {
      const { title, owner } = await loadFixture(deployTitleFixture);

      await title.mintTitle(
        owner.address,
        1,
        "https://jpmc.title/1",
        "0x1234567890123456789012345678901234567890",
        500000,
        "NY"
      );

      const detail = await title.getTitleDetail(1);
      expect(detail.lastSalePrice).to.equal(500000);
      expect(detail.jurisdiction).to.equal("NY");
    });
  });

  describe("Access Control", function () {
    it("should restrict minting to compliance officer role", async function () {
      const { title, unauthorized } = await loadFixture(deployTitleFixture);

      await expect(
        title
          .connect(unauthorized)
          .mintTitle(
            unauthorized.address,
            1,
            "https://jpmc.title/1",
            "0x1234567890123456789012345678901234567890",
            500000,
            "NY"
          )
      ).to.be.revertedWithCustomError(title, "UnauthorizedCaller");
    });
  });

  describe("Encumbrance", function () {
    it("should allow setting encumbrance status", async function () {
      const { title, owner, complianceOfficer } = await loadFixture(deployTitleFixture);

      await title.mintTitle(
        owner.address,
        1,
        "https://jpmc.title/1",
        "0x1234567890123456789012345678901234567890",
        500000,
        "NY"
      );

      await title.connect(complianceOfficer).setEncumbrance(1, true);
      const detail = await title.getTitleDetail(1);
      expect(detail.isEncumbered).to.be.true;
    });

    it("should block transfer when encumbered", async function () {
      const { title, owner, complianceOfficer, buyer, seller } = await loadFixture(
        deployTitleFixture
      );

      await title.mintTitle(
        seller.address,
        1,
        "https://jpmc.title/1",
        "0x1234567890123456789012345678901234567890",
        500000,
        "NY"
      );

      await title.connect(complianceOfficer).setEncumbrance(1, true);

      await expect(
        title.connect(seller).safeTransferTitle(seller.address, buyer.address, 1)
      ).to.be.revertedWithCustomError(title, "TitleEncumbered");
    });
  });
});