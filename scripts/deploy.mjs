const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  console.log("Deploying contracts with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString());

  const TitleTokenization = await hre.ethers.getContractFactory("TitleTokenization");
  const titleTokenization = await TitleTokenization.deploy(deployer.address);
  await titleTokenization.waitForDeployment();
  const titleAddress = await titleTokenization.getAddress();
  console.log("TitleTokenization deployed to:", titleAddress);

  const CorporateTreasury = await hre.ethers.getContractFactory("CorporateTreasury");
  const corporateTreasury = await CorporateTreasury.deploy(deployer.address);
  await corporateTreasury.waitForDeployment();
  const treasuryAddress = await corporateTreasury.getAddress();
  console.log("CorporateTreasury deployed to:", treasuryAddress);

  const TradeFinance = await hre.ethers.getContractFactory("TradeFinance");
  const tradeFinance = await TradeFinance.deploy(deployer.address);
  await tradeFinance.waitForDeployment();
  const tradeAddress = await tradeFinance.getAddress();
  console.log("TradeFinance deployed to:", tradeAddress);

  console.log("\n--- Deployment Summary ---");
  console.log("TitleTokenization:", titleAddress);
  console.log("CorporateTreasury:", treasuryAddress);
  console.log("TradeFinance:", tradeAddress);

  if (hre.network.name !== "localhost" && hre.network.name !== "hardhat") {
    console.log("\nVerifying contracts on Etherscan...");
    await hre.run("verify:verify", {
      address: titleAddress,
      constructorArguments: [deployer.address],
    });
    await hre.run("verify:verify", {
      address: treasuryAddress,
      constructorArguments: [deployer.address],
    });
    await hre.run("verify:verify", {
      address: tradeAddress,
      constructorArguments: [deployer.address],
    });
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });