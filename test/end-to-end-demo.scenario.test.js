import { expect } from "chai";
import hre from "hardhat";

/**
 * End-to-end scenario aligned with scripts/deploy.js:
 * same deploy + seed shape, then signed transitions using the deployer (all facility roles).
 * Proves compile → deploy → multi-step workflow without the UI or Spring API.
 */
describe("End-to-end demo scenario (deploy.js parity + full workflow)", function () {
  it("deploys, seeds facility #1 Active, then hold → release → hold → liquidate → finalize", async function () {
    const { ethers } = await hre.network.connect();
    const [deployer, borrower, , , , recovery] = await ethers.getSigners();

    const treasury = await ethers.deployContract("CorporateTreasury", [deployer.address]);
    const title = await ethers.deployContract("TitleTokenization", [deployer.address]);
    await ethers.deployContract("TradeFinance", [deployer.address]);
    const facility = await ethers.deployContract("CollateralizedFacility", [
      deployer.address,
      treasury.target,
      title.target,
    ]);

    const demoCash = ethers.parseEther("10000");
    const titleId = 1n;
    const propertyAddr = "0x1234567890123456789012345678901234567890";

    await treasury.transfer(borrower.address, demoCash);
    await title.mintTitle(
      borrower.address,
      titleId,
      "https://poc.jpmc-evm/demo/1",
      propertyAddr,
      1n,
      "NY",
    );

    await facility.createFacility(borrower.address, 0n);
    const facilityId = 1n;
    await treasury.connect(borrower).approve(facility.target, demoCash);
    await title.connect(borrower).setApprovalForAll(facility.target, true);
    await facility.connect(borrower).fundAndEncumber(facilityId, demoCash, titleId);

    let f = await facility.getFacility(facilityId);
    expect(f.state).to.equal(1n);

    await facility.connect(deployer).applyComplianceHold(facilityId);
    f = await facility.getFacility(facilityId);
    expect(f.state).to.equal(2n);

    await facility.connect(deployer).releaseComplianceHold(facilityId);
    f = await facility.getFacility(facilityId);
    expect(f.state).to.equal(1n);

    await facility.connect(deployer).applyComplianceHold(facilityId);
    await facility.connect(deployer).commenceLiquidation(facilityId);
    f = await facility.getFacility(facilityId);
    expect(f.state).to.equal(3n);

    await facility.connect(deployer).finalizeLiquidation(facilityId, recovery.address);

    f = await facility.getFacility(facilityId);
    expect(f.state).to.equal(4n);
    expect(f.lockedCash).to.equal(0n);
    expect(await treasury.balanceOf(recovery.address)).to.equal(demoCash);
    expect(await title.ownerOf(titleId)).to.equal(recovery.address);
  });
});
