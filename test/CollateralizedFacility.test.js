import { expect } from "chai";
import hre from "hardhat";

describe("CollateralizedFacility", function () {
  async function deployAllFixture(connection) {
    const { ethers } = connection;
    const [admin, banker, compliance, liquidator, borrower, recovery] = await ethers.getSigners();

    const treasury = await ethers.deployContract("CorporateTreasury", [admin.address]);
    const title = await ethers.deployContract("TitleTokenization", [admin.address]);

    const facility = await ethers.deployContract("CollateralizedFacility", [
      admin.address,
      treasury.target,
      title.target,
    ]);

    const complianceOfficerRole = await title.COMPLIANCE_OFFICER_ROLE();
    await title.connect(admin).grantRole(complianceOfficerRole, compliance.address);

    const BANKER = await facility.FACILITY_BANKER_ROLE();
    const COMP = await facility.COMPLIANCE_ROLE();
    const LIQ = await facility.LIQUIDATION_AGENT_ROLE();
    await facility.connect(admin).grantRole(BANKER, banker.address);
    await facility.connect(admin).grantRole(COMP, compliance.address);
    await facility.connect(admin).grantRole(LIQ, liquidator.address);

    const propertyAddr = "0x1234567890123456789012345678901234567890";
    await title.connect(compliance).mintTitle(borrower.address, 42, "uri", propertyAddr, 1, "NY");

    const cashAmount = ethers.parseEther("10000");
    await treasury.connect(admin).transfer(borrower.address, cashAmount);

    return {
      ethers,
      treasury,
      title,
      facility,
      admin,
      banker,
      compliance,
      liquidator,
      borrower,
      recovery,
      cashAmount,
    };
  }

  it("funds and encumbers, then releases normally", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { treasury, title, facility, banker, borrower, cashAmount } =
      await networkHelpers.loadFixture(deployAllFixture);

    await facility.connect(banker).createFacility(borrower.address, 7);
    const id = 1n;

    await treasury.connect(borrower).approve(facility.target, cashAmount);
    await title.connect(borrower).setApprovalForAll(facility.target, true);

    await facility.connect(borrower).fundAndEncumber(id, cashAmount, 42n);

    const f = await facility.getFacility(id);
    expect(f.state).to.equal(1);
    expect(f.lockedCash).to.equal(cashAmount);

    await facility.connect(banker).releaseFacility(id);

    const f2 = await facility.getFacility(id);
    expect(f2.state).to.equal(4);
    expect(await treasury.balanceOf(borrower.address)).to.equal(cashAmount);
    expect(await title.ownerOf(42n)).to.equal(borrower.address);
  });

  it("getFacilityParts matches getFacility", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { treasury, title, facility, banker, borrower, cashAmount } =
      await networkHelpers.loadFixture(deployAllFixture);

    await facility.connect(banker).createFacility(borrower.address, 99n);
    const id = 1n;
    await treasury.connect(borrower).approve(facility.target, cashAmount);
    await title.connect(borrower).setApprovalForAll(facility.target, true);
    await facility.connect(borrower).fundAndEncumber(id, cashAmount, 42n);

    const f = await facility.getFacility(id);
    const p = await facility.getFacilityParts(id);
    expect(p.borrower).to.equal(f.borrower);
    expect(p.state).to.equal(f.state);
    expect(p.lockedCash).to.equal(f.lockedCash);
    expect(p.titleTokenId).to.equal(f.titleTokenId);
    expect(p.tradeFinanceRefId).to.equal(f.tradeFinanceRefId);
  });

  it("applies compliance hold and release", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { treasury, title, facility, banker, compliance, borrower, cashAmount } =
      await networkHelpers.loadFixture(deployAllFixture);

    await facility.connect(banker).createFacility(borrower.address, 0);
    const id = 1n;
    await treasury.connect(borrower).approve(facility.target, cashAmount);
    await title.connect(borrower).setApprovalForAll(facility.target, true);
    await facility.connect(borrower).fundAndEncumber(id, cashAmount, 42n);

    await facility.connect(compliance).applyComplianceHold(id);
    let f = await facility.getFacility(id);
    expect(f.state).to.equal(2);

    await facility.connect(compliance).releaseComplianceHold(id);
    f = await facility.getFacility(id);
    expect(f.state).to.equal(1);
  });

  it("liquidates to recovery address", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { treasury, title, facility, banker, compliance, liquidator, borrower, recovery, cashAmount } =
      await networkHelpers.loadFixture(deployAllFixture);

    await facility.connect(banker).createFacility(borrower.address, 0);
    const id = 1n;
    await treasury.connect(borrower).approve(facility.target, cashAmount);
    await title.connect(borrower).setApprovalForAll(facility.target, true);
    await facility.connect(borrower).fundAndEncumber(id, cashAmount, 42n);

    await facility.connect(compliance).applyComplianceHold(id);
    await facility.connect(compliance).commenceLiquidation(id);
    await facility.connect(liquidator).finalizeLiquidation(id, recovery.address);

    const f = await facility.getFacility(id);
    expect(f.state).to.equal(4);
    expect(await treasury.balanceOf(recovery.address)).to.equal(cashAmount);
    expect(await title.ownerOf(42n)).to.equal(recovery.address);
  });

  it("reverts finalizeLiquidation if not liquidation agent", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { treasury, title, facility, banker, compliance, borrower, cashAmount } =
      await networkHelpers.loadFixture(deployAllFixture);

    await facility.connect(banker).createFacility(borrower.address, 0);
    const id = 1n;
    await treasury.connect(borrower).approve(facility.target, cashAmount);
    await title.connect(borrower).setApprovalForAll(facility.target, true);
    await facility.connect(borrower).fundAndEncumber(id, cashAmount, 0n);

    await facility.connect(compliance).commenceLiquidation(id);

    await expect(
      facility.connect(compliance).finalizeLiquidation(id, borrower.address)
    ).to.be.revertedWithCustomError(facility, "AccessControlUnauthorizedAccount");
  });
});
