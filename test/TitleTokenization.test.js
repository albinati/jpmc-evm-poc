import { expect } from "chai";
import hre from "hardhat";

describe("TitleTokenization", function () {
  async function deployTitleFixture(connection) {
    const { ethers } = connection;
    const [owner, complianceOfficer, buyer, seller, unauthorized] = await ethers.getSigners();

    const title = await ethers.deployContract("TitleTokenization", [owner.address]);

    const COMPLIANCE_OFFICER_ROLE = await title.COMPLIANCE_OFFICER_ROLE();
    await title.connect(owner).grantRole(COMPLIANCE_OFFICER_ROLE, complianceOfficer.address);

    return { title, owner, complianceOfficer, buyer, seller, unauthorized };
  }

  it("should allow compliance officer to mint title", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { title, owner, complianceOfficer } = await networkHelpers.loadFixture(deployTitleFixture);

    await title.connect(complianceOfficer).mintTitle(
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
    const { networkHelpers } = await hre.network.connect();
    const { title, owner, complianceOfficer } = await networkHelpers.loadFixture(deployTitleFixture);

    await title.connect(complianceOfficer).mintTitle(
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

  it("should restrict minting to compliance officer role", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { title, unauthorized } = await networkHelpers.loadFixture(deployTitleFixture);

    await expect(
      title.connect(unauthorized).mintTitle(
        unauthorized.address,
        1,
        "https://jpmc.title/1",
        "0x1234567890123456789012345678901234567890",
        500000,
        "NY"
      )
    ).to.be.revertedWithCustomError(title, "AccessControlUnauthorizedAccount");
  });

  it("should allow setting encumbrance status", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { title, owner, complianceOfficer } = await networkHelpers.loadFixture(deployTitleFixture);

    await title.connect(complianceOfficer).mintTitle(
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
    const { networkHelpers } = await hre.network.connect();
    const { title, owner, complianceOfficer, buyer, seller } = await networkHelpers.loadFixture(
      deployTitleFixture
    );

    await title.connect(complianceOfficer).mintTitle(
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
    ).to.be.revertedWithCustomError(title, "EncumberedTitle");
  });
});
