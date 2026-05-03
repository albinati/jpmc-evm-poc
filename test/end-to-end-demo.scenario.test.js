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

  it("treasury fraud→freeze→thaw→forceTransfer scene", async function () {
    const { ethers, networkHelpers } = await hre.network.connect();
    const [deployer, suspect, recovery] = await ethers.getSigners();
    const treasury = await ethers.deployContract("CorporateTreasury", [deployer.address]);

    await treasury.transfer(suspect.address, ethers.parseEther("5000"));

    await treasury.freezeAccount(suspect.address, 60);
    await expect(
      treasury.connect(suspect).transfer(recovery.address, 100n)
    ).to.be.revertedWithCustomError(treasury, "AccountFrozen");

    await networkHelpers.time.increase(120);
    await treasury.connect(suspect).transfer(recovery.address, ethers.parseEther("100"));

    await treasury.addToBlacklist(suspect.address);
    await expect(
      treasury.connect(suspect).transfer(recovery.address, 100n)
    ).to.be.revertedWithCustomError(treasury, "BlacklistedAccount");

    await treasury.forceTransfer(
      suspect.address,
      recovery.address,
      ethers.parseEther("4900"),
      "0x" + "00".repeat(32),
    );
    expect(await treasury.balanceOf(suspect.address)).to.equal(0n);
  });

  it("trade finance create→factor→partial-settle→extend scene", async function () {
    const { ethers, networkHelpers } = await hre.network.connect();
    const [deployer, supplier, buyer, factor, settlementAgent] = await ethers.getSigners();
    const trade = await ethers.deployContract("TradeFinance", [deployer.address]);

    const due = (await networkHelpers.time.latest()) + 30 * 24 * 60 * 60;

    await trade.createInvoice(supplier.address, buyer.address, 100000n, due, "INV-E2E-001", 100000n);
    await trade.connect(supplier).setApprovalForAll(trade.target, true);

    await trade.factorInvoice(1, factor.address, 40000n);
    expect(await trade.balanceOf(factor.address, 1)).to.equal(40000n);

    await trade.connect(supplier).safeTransferFrom(supplier.address, deployer.address, 1, 30000n, "0x");
    await trade.connect(deployer).settleInvoice(1, 30000n);
    let inv = await trade.getInvoice(1);
    expect(inv.settled).to.equal(false);

    const newDue = due + 14 * 24 * 60 * 60;
    await trade.extendDueDate(1, newDue);
    inv = await trade.getInvoice(1);
    expect(inv.dueDate).to.equal(BigInt(newDue));
  });

  it("title encumber→fail-transfer→release→succeed-transfer scene", async function () {
    const { ethers } = await hre.network.connect();
    const [deployer, holder, buyer] = await ethers.getSigners();
    const title = await ethers.deployContract("TitleTokenization", [deployer.address]);

    const propertyAddr = "0x1234567890123456789012345678901234567890";
    await title.mintTitle(holder.address, 7n, "https://t/7", propertyAddr, 1n, "NY");

    const TRANSFER_AGENT = await title.TRANSFER_AGENT_ROLE();
    await title.grantRole(TRANSFER_AGENT, holder.address);

    await title.setEncumbrance(7n, true);
    await expect(
      title.connect(holder).safeTransferTitle(holder.address, buyer.address, 7n)
    ).to.be.revertedWithCustomError(title, "EncumberedTitle");

    await title.setEncumbrance(7n, false);
    await title.connect(holder).safeTransferTitle(holder.address, buyer.address, 7n);
    expect(await title.ownerOf(7n)).to.equal(buyer.address);

    await title.updateTokenURI(7n, "https://t/7?v=2");
    expect(await title.tokenURI(7n)).to.equal("https://t/7?v=2");
  });
});
