const { expect } = require("chai");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/fixtures");
const { ethers } = require("hardhat");

describe("TradeFinance", function () {
  async function deployTradeFixture() {
    const [owner, banker, compliance, settlementAgent, receivableParty, payableParty, factor] =
      await ethers.getSigners();

    const TradeFinance = await ethers.getContractFactory("TradeFinance");
    const trade = await TradeFinance.deploy(owner.address);

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

  describe("Invoice Creation", function () {
    it("should create invoice", async function () {
      const { trade, owner, banker, receivableParty, payableParty } = await loadFixture(
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
      expect(invoice.reference).to.equal("INV-2024-001");
    });

    it("should emitInvoiceCreated event", async function () {
      const { trade, owner, banker, receivableParty, payableParty } = await loadFixture(
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
        .withArgs(1, receivableParty.address, payableParty.address, 100000, dueDate, "INV-2024-002");
    });
  });

  describe("Duplicate Reference", function () {
    it("should reject duplicate reference", async function () {
      const { trade, banker, receivableParty, payableParty } = await loadFixture(
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
  });

  describe("Settlement", function () {
    it("should settle full invoice", async function () {
      const {
        trade,
        owner,
        banker,
        settlementAgent,
        receivableParty,
        payableParty,
      } = await loadFixture(deployTradeFixture);

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

      await trade.connect(settlementAgent).settleInvoice(1, 100000);

      const invoice = await trade.getInvoice(1);
      expect(invoice.settled).to.be.true;
    });

    it("should partial settle invoice", async function () {
      const {
        trade,
        owner,
        banker,
        settlementAgent,
        receivableParty,
        payableParty,
      } = await loadFixture(deployTradeFixture);

      const dueDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

      await trade
        .connect(banker)
        .createInvoice(
          receivableParty.address,
          payableParty.address,
          100000,
          dueDate,
          "INV-PARTIAL-001",
          1
        );

      await trade.connect(settlementAgent).settleInvoice(1, 50000);

      const invoice = await trade.getInvoice(1);
      expect(invoice.settled).to.be.false;
    });
  });

  describe("Factoring", function () {
    it("should factor invoice", async function () {
      const { trade, owner, banker, receivableParty, factor } = await loadFixture(
        deployTradeFixture
      );

      const dueDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

      await trade
        .connect(banker)
        .createInvoice(
          receivableParty.address,
          owner.address,
          100000,
          dueDate,
          "INV-FACTOR-001",
          1
        );

      await trade.connect(banker).factorInvoice(1, factor.address, 50000);
    });
  });

  describe("Access Control", function () {
    it("should restrict invoice creation to banker role", async function () {
      const { trade, owner, unauthorized, receivableParty, payableParty } =
        await loadFixture(deployTradeFixture);

      const dueDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

      await expect(
        trade
          .connect(unauthorized)
          .createInvoice(
            receivableParty.address,
            payableParty.address,
            100000,
            dueDate,
            "INV-UNAUTH-001",
            1
          )
      ).to.be.reverted;
    });
  });

  describe("Pausable", function () {
    it("should allow compliance to pause", async function () {
      const { trade, owner, compliance, banker, receivableParty, payableParty } =
        await loadFixture(deployTradeFixture);

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
      ).to.be.revertedWith("Pausable: paused");
    });
  });
});