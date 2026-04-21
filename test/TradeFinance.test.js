import { expect } from "chai";
import hre from "hardhat";

describe("TradeFinance", function () {
  async function deployTradeFixture(connection) {
    const { ethers } = connection;
    const [owner, banker, compliance, settlementAgent, receivableParty, payableParty, factor] =
      await ethers.getSigners();

    const trade = await ethers.deployContract("TradeFinance", [owner.address]);

    await trade.connect(owner).grantRole(await trade.BANKER_ROLE(), banker.address);
    await trade.connect(owner).grantRole(await trade.COMPLIANCE_ROLE(), compliance.address);
    await trade.connect(owner).grantRole(await trade.SETTLEMENT_AGENT_ROLE(), settlementAgent.address);

    return {
      trade,
      owner,
      banker,
      compliance,
      settlementAgent,
      receivableParty,
      payableParty,
      factor,
    };
  }

  it("should create invoice", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { trade, banker, receivableParty, payableParty } = await networkHelpers.loadFixture(
      deployTradeFixture
    );

    const dueDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

    await trade
      .connect(banker)
      .createInvoice(
        receivableParty.address,
        payableParty.address,
        100000,
        dueDate,
        "INV-2024-001",
        1
      );

    const invoice = await trade.getInvoice(1);
    expect(invoice.receivableParty).to.equal(receivableParty.address);
    expect(invoice.amount).to.equal(100000);
    expect(invoice.invoiceReference).to.equal("INV-2024-001");
  });

  it("should emit InvoiceCreated event", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { trade, banker, receivableParty, payableParty } = await networkHelpers.loadFixture(
      deployTradeFixture
    );

    const dueDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

    await expect(
      trade
        .connect(banker)
        .createInvoice(
          receivableParty.address,
          payableParty.address,
          100000,
          dueDate,
          "INV-2024-002",
          1
        )
    )
      .to.emit(trade, "InvoiceCreated")
      .withArgs(1n, receivableParty.address, payableParty.address, 100000n, BigInt(dueDate), "INV-2024-002");
  });

  it("should reject duplicate reference", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { trade, banker, receivableParty, payableParty } = await networkHelpers.loadFixture(
      deployTradeFixture
    );

    const dueDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

    await trade
      .connect(banker)
      .createInvoice(
        receivableParty.address,
        payableParty.address,
        100000,
        dueDate,
        "INV-DUP-001",
        1
      );

    await expect(
      trade
        .connect(banker)
        .createInvoice(
          receivableParty.address,
          payableParty.address,
          50000,
          dueDate,
          "INV-DUP-001",
          1
        )
    ).to.be.revertedWithCustomError(trade, "DuplicateReference");
  });

  it("should settle full invoice", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { trade, banker, settlementAgent, receivableParty, payableParty } =
      await networkHelpers.loadFixture(deployTradeFixture);

    const dueDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

    await trade
      .connect(banker)
      .createInvoice(
        receivableParty.address,
        payableParty.address,
        100000,
        dueDate,
        "INV-SETTLE-001",
        1
      );

    await trade
      .connect(receivableParty)
      .safeTransferFrom(receivableParty.address, settlementAgent.address, 1, 1, "0x");

    await trade.connect(settlementAgent).settleInvoice(1, 100000);

    const invoice = await trade.getInvoice(1);
    expect(invoice.settled).to.be.true;
  });

  it("should partial settle invoice", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { trade, banker, settlementAgent, receivableParty, payableParty } =
      await networkHelpers.loadFixture(deployTradeFixture);

    const dueDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

    await trade
      .connect(banker)
      .createInvoice(
        receivableParty.address,
        payableParty.address,
        100000,
        dueDate,
        "INV-PARTIAL-001",
        100000
      );

    await trade
      .connect(receivableParty)
      .safeTransferFrom(receivableParty.address, settlementAgent.address, 1, 100000, "0x");

    await trade.connect(settlementAgent).settleInvoice(1, 50000);

    const invoice = await trade.getInvoice(1);
    expect(invoice.settled).to.be.false;
  });

  it("should factor invoice", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { trade, owner, banker, receivableParty, factor } = await networkHelpers.loadFixture(
      deployTradeFixture
    );

    const dueDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

    await trade
      .connect(banker)
      .createInvoice(receivableParty.address, owner.address, 100000, dueDate, "INV-FACTOR-001", 100000);

    await trade.connect(receivableParty).setApprovalForAll(trade.target, true);

    await trade.connect(banker).factorInvoice(1, factor.address, 50000);
  });

  it("should restrict invoice creation to banker role", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { trade, receivableParty, payableParty } = await networkHelpers.loadFixture(deployTradeFixture);

    const dueDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

    await expect(
      trade
        .connect(payableParty)
        .createInvoice(
          receivableParty.address,
          payableParty.address,
          100000,
          dueDate,
          "INV-UNAUTH-001",
          1
        )
    ).to.be.revertedWithCustomError(trade, "AccessControlUnauthorizedAccount");
  });

  it("should allow compliance to pause", async function () {
    const { networkHelpers } = await hre.network.connect();
    const { trade, compliance, banker, receivableParty, payableParty } =
      await networkHelpers.loadFixture(deployTradeFixture);

    await trade.connect(compliance).pauseContract();

    const dueDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

    await expect(
      trade
        .connect(banker)
        .createInvoice(
          receivableParty.address,
          payableParty.address,
          100000,
          dueDate,
          "INV-PAUSED-001",
          1
        )
    ).to.be.revertedWithCustomError(trade, "EnforcedPause");
  });
});
