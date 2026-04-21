import hre from "hardhat";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const { ethers } = await hre.network.connect();
  const [deployer] = await ethers.getSigners();

  const treasury = await ethers.deployContract("CorporateTreasury", [deployer.address]);
  const title = await ethers.deployContract("TitleTokenization", [deployer.address]);
  const trade = await ethers.deployContract("TradeFinance", [deployer.address]);
  const facility = await ethers.deployContract("CollateralizedFacility", [
    deployer.address,
    treasury.target,
    title.target,
  ]);

  const [, borrower] = await ethers.getSigners();
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
    "NY"
  );
  await facility.createFacility(borrower.address, 0n);
  const facilityId = 1n;
  await treasury.connect(borrower).approve(facility.target, demoCash);
  await title.connect(borrower).setApprovalForAll(facility.target, true);
  await facility.connect(borrower).fundAndEncumber(facilityId, demoCash, titleId);
  // eslint-disable-next-line no-console
  console.log("Seeded CollateralizedFacility #1 (Active) for demo UI / workflow API");

  const deployment = {
    network: (await ethers.provider.getNetwork()).name || "unknown",
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    contracts: {
      CorporateTreasury: treasury.target,
      TitleTokenization: title.target,
      TradeFinance: trade.target,
      CollateralizedFacility: facility.target,
    },
    deployedAt: new Date().toISOString(),
  };

  const outDir = path.join(process.cwd(), "deployments");
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, "local.json");
  fs.writeFileSync(outFile, JSON.stringify(deployment, null, 2));
  // eslint-disable-next-line no-console
  console.log("Wrote", outFile, deployment);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
