import hre from "hardhat";
import fs from "node:fs";
import path from "node:path";

/**
 * Deploys the four POC contracts, wires up segregation-of-duty roles across three
 * demo signers (banker / compliance / liquidation agent), and seeds enough state
 * for every UI panel to have something live to show.
 *
 * Signer resolution: prefer the explicit POC_*_PRIVATE_KEY env vars (so a remote
 * deploy can match the running orchestration API), otherwise default to Hardhat
 * accounts #0 / #1 / #2 (no env required for local).
 */
async function main() {
  const { ethers } = await hre.network.connect();
  const signers = await ethers.getSigners();
  const [deployer] = signers;

  const provider = ethers.provider;
  const bankerKey = process.env.POC_BANKER_PRIVATE_KEY;
  const complianceKey = process.env.POC_COMPLIANCE_PRIVATE_KEY;
  const liquidationKey = process.env.POC_LIQUIDATION_PRIVATE_KEY;

  const banker = bankerKey ? new ethers.Wallet(bankerKey, provider) : signers[1] ?? signers[0];
  const compliance = complianceKey ? new ethers.Wallet(complianceKey, provider) : signers[2] ?? signers[0];
  const liquidationAgent = liquidationKey
    ? new ethers.Wallet(liquidationKey, provider)
    : signers[3] ?? signers[0];

  for (const w of [banker, compliance, liquidationAgent]) {
    if ((await provider.getBalance(w.address)) === 0n) {
      await deployer.sendTransaction({ to: w.address, value: ethers.parseEther("100") });
    }
  }

  const treasury = await ethers.deployContract("CorporateTreasury", [deployer.address]);
  const title = await ethers.deployContract("TitleTokenization", [deployer.address]);
  const trade = await ethers.deployContract("TradeFinance", [deployer.address]);
  const facility = await ethers.deployContract("CollateralizedFacility", [
    deployer.address,
    treasury.target,
    title.target,
  ]);

  await Promise.all([
    treasury.waitForDeployment(),
    title.waitForDeployment(),
    trade.waitForDeployment(),
    facility.waitForDeployment(),
  ]);

  const [
    treasuryComplianceRole,
    treasuryOperatorRole,
    titleComplianceRole,
    titleTransferAgentRole,
    tradeBankerRole,
    tradeComplianceRole,
    tradeSettlementRole,
    facilityBankerRole,
    facilityComplianceRole,
    facilityLiquidationRole,
  ] = await Promise.all([
    treasury.COMPLIANCE_ROLE(),
    treasury.TREASURY_OPERATOR_ROLE(),
    title.COMPLIANCE_OFFICER_ROLE(),
    title.TRANSFER_AGENT_ROLE(),
    trade.BANKER_ROLE(),
    trade.COMPLIANCE_ROLE(),
    trade.SETTLEMENT_AGENT_ROLE(),
    facility.FACILITY_BANKER_ROLE(),
    facility.COMPLIANCE_ROLE(),
    facility.LIQUIDATION_AGENT_ROLE(),
  ]);

  await (await treasury.grantRole(treasuryComplianceRole, compliance.address)).wait();
  await (await treasury.grantRole(treasuryOperatorRole, banker.address)).wait();

  await (await title.grantRole(titleComplianceRole, compliance.address)).wait();
  await (await title.grantRole(titleTransferAgentRole, banker.address)).wait();

  await (await trade.grantRole(tradeBankerRole, banker.address)).wait();
  await (await trade.grantRole(tradeComplianceRole, compliance.address)).wait();
  await (await trade.grantRole(tradeSettlementRole, liquidationAgent.address)).wait();

  await (await facility.grantRole(facilityBankerRole, banker.address)).wait();
  await (await facility.grantRole(facilityComplianceRole, compliance.address)).wait();
  await (await facility.grantRole(facilityLiquidationRole, liquidationAgent.address)).wait();

  const borrower = banker;
  const demoCash = ethers.parseEther("10000");
  const titleId = 1n;
  const propertyAddr = "0x1234567890123456789012345678901234567890";

  await (await treasury.transfer(borrower.address, demoCash * 3n)).wait();
  await (
    await title
      .connect(compliance)
      .mintTitle(borrower.address, titleId, "https://poc.jpmc-evm/demo/1", propertyAddr, 1n, "NY")
  ).wait();

  await (await facility.connect(banker).createFacility(borrower.address, 0n)).wait();
  const facilityId = 1n;
  await (await treasury.connect(borrower).approve(facility.target, demoCash)).wait();
  await (await title.connect(borrower).setApprovalForAll(facility.target, true)).wait();
  await (await facility.connect(borrower).fundAndEncumber(facilityId, demoCash, titleId)).wait();
  console.log("Seeded CollateralizedFacility #1 (Active) for demo UI / workflow API");

  const titleId2 = 2n;
  await (
    await title
      .connect(compliance)
      .mintTitle(banker.address, titleId2, "https://poc.jpmc-evm/demo/2", propertyAddr, 2n, "NY")
  ).wait();
  console.log("Seeded TitleTokenization #2 (held by banker, unencumbered) for transfer demo");

  const dueDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
  await (
    await trade
      .connect(banker)
      .createInvoice(banker.address, liquidationAgent.address, ethers.parseEther("100000"), dueDate, "INV-DEMO-001", ethers.parseEther("100000"))
  ).wait();
  console.log("Seeded TradeFinance invoice #1 (banker → liquidation agent) for factor / settle demo");

  const network = await provider.getNetwork();
  const deployment = {
    network: network.name || "unknown",
    chainId: Number(network.chainId),
    deployer: deployer.address,
    contracts: {
      CorporateTreasury: treasury.target,
      TitleTokenization: title.target,
      TradeFinance: trade.target,
      CollateralizedFacility: facility.target,
    },
    signers: {
      banker: banker.address,
      compliance: compliance.address,
      liquidationAgent: liquidationAgent.address,
    },
    deployedAt: new Date().toISOString(),
  };

  const outFile = process.env.DEPLOYMENTS_OUT
    ? path.resolve(process.env.DEPLOYMENTS_OUT)
    : path.join(process.cwd(), "deployments", "local.json");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(deployment, null, 2));
  console.log("Wrote", outFile, deployment);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
