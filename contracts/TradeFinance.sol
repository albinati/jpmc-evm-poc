// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract TradeFinance is ERC1155, ERC1155Supply, ERC1155Burnable, AccessControl, Ownable, Pausable {
    bytes32 public constant BANKER_ROLE = keccak256("BANKER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant SETTLEMENT_AGENT_ROLE = keccak256("SETTLEMENT_AGENT_ROLE");

    struct Invoice {
        address receivableParty;
        address payableParty;
        uint256 amount;
        uint256 dueDate;
        bool settled;
        string reference;
    }

    mapping(uint256 => Invoice) private _invoices;
    mapping(address => uint256[]) private _partyInvoices;
    mapping(string => uint256) private _referenceToInvoiceId;

    uint256 private _nextInvoiceId;
    uint256 public constant MAX_INVOICE_AMOUNT = 10_000_000_000 * 10 ** 18;

    event InvoiceCreated(
        uint256 indexed invoiceId,
        address indexed receivableParty,
        address indexed payableParty,
        uint256 amount,
        uint256 dueDate,
        string reference
    );
    event InvoiceSettled(uint256 indexed invoiceId, address indexed settler);
    event InvoicePartiallySettled(
        uint256 indexed invoiceId,
        uint256 partialAmount,
        address indexed settler
    );
    event InvoiceFactored(
        uint256 indexed invoiceId,
        address indexed factor,
        uint256 amount
    );
    event SettlementBlocked(address indexed from, address indexed to);

    error InvalidAmount(uint256 amount);
    error InvoiceSettled(uint256 invoiceId);
    error InvoiceExpired(uint256 invoiceId, uint256 dueDate);
    error DuplicateReference(string reference);
    error InvalidParty(address party);
    error InvoiceNotFound(uint256 invoiceId);
    error PartialSettlementLimit(uint256 remaining, uint256 requested);

    constructor(address initialOwner)
        ERC1155("https://jpmc-trade-finance.internal/offchain/invoice/{id}")
        Ownable(initialOwner)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(BANKER_ROLE, initialOwner);
        _grantRole(COMPLIANCE_ROLE, initialOwner);
        _grantRole(SETTLEMENT_AGENT_ROLE, initialOwner);
        _nextInvoiceId = 1;
    }

    function createInvoice(
        address receivableParty,
        address payableParty,
        uint256 amount,
        uint256 dueDate,
        string memory reference,
        uint256 initialSupply
    )
        public
        onlyRole(BANKER_ROLE)
        returns (uint256)
    {
        require(receivableParty != address(0), InvalidParty(receivableParty));
        require(payableParty != address(0), InvalidParty(payableParty));
        require(amount > 0 && amount <= MAX_INVOICE_AMOUNT, InvalidAmount(amount));
        require(
            bytes(_referenceToInvoiceId[reference]).length == 0,
            DuplicateReference(reference)
        );

        uint256 invoiceId = _nextInvoiceId++;

        _invoices[invoiceId] = Invoice({
            receivableParty: receivableParty,
            payableParty: payableParty,
            amount: amount,
            dueDate: dueDate,
            settled: false,
            reference: reference
        });

        _referenceToInvoiceId[reference] = invoiceId;
        _partyInvoices[receivableParty].push(invoiceId);
        _partyInvoices[payableParty].push(invoiceId);

        if (initialSupply > 0) {
            _mint(receivableParty, invoiceId, initialSupply, "");
        }

        emit InvoiceCreated(
            invoiceId,
            receivableParty,
            payableParty,
            amount,
            dueDate,
            reference
        );

        return invoiceId;
    }

    function settleInvoice(uint256 invoiceId, uint256 amount)
        public
        whenNotPaused()
        onlyRole(SETTLEMENT_AGENT_ROLE)
    {
        Invoice storage invoice = _invoices[invoiceId];
        require(invoice.settled == false, InvoiceSettled(invoiceId));

        if (block.timestamp > invoice.dueDate) {
            revert InvoiceExpired(invoiceId, invoice.dueDate);
        }

        uint256 currentSupply = supplyOf(invoiceId);

        if (amount >= invoice.amount) {
            invoice.settled = true;
            _burn(_msgSender(), invoiceId, currentSupply);
            emit InvoiceSettled(invoiceId, _msgSender());
        } else {
            if (amount > currentSupply) {
                revert PartialSettlementLimit(currentSupply, amount);
            }
            _burn(_msgSender(), invoiceId, amount);
            emit InvoicePartiallySettled(invoiceId, amount, _msgSender());
        }
    }

    function factorInvoice(
        uint256 invoiceId,
        address factor,
        uint256 amount
    )
        public
        onlyRole(BANKER_ROLE)
    {
        Invoice storage invoice = _invoices[invoiceId];
        require(invoice.settled == false, InvoiceSettled(invoiceId));
        require(factor != address(0), InvalidParty(factor));

        uint256 currentSupply = supplyOf(invoiceId);
        require(amount <= currentSupply, InvalidAmount(amount));

        _safeTransferFrom(invoice.receivableParty, factor, invoiceId, amount, "");

        emit InvoiceFactored(invoiceId, factor, amount);
    }

    function factorFullInvoice(uint256 invoiceId, address factor)
        public
        onlyRole(BANKER_ROLE)
    {
        Invoice storage invoice = _invoices[invoiceId];
        require(invoice.settled == false, InvoiceSettled(invoiceId));
        require(factor != address(0), InvalidParty(factor));

        uint256 currentSupply = supplyOf(invoiceId);
        _safeTransferFrom(invoice.receivableParty, factor, invoiceId, currentSupply, "");

        emit InvoiceFactored(invoiceId, factor, currentSupply);
    }

    function getInvoice(uint256 invoiceId)
        public
        view
        returns (Invoice memory)
    {
        return _invoices[invoiceId];
    }

    function getPartyInvoices(address party)
        public
        view
        returns (uint256[] memory)
    {
        return _partyInvoices[party];
    }

    function getInvoiceByReference(string memory reference)
        public
        view
        returns (uint256)
    {
        return _referenceToInvoiceId[reference];
    }

    function supplyOf(uint256 id) public view returns (uint256) {
        return totalSupply(id);
    }

    function pauseContract() public onlyRole(COMPLIANCE_ROLE) {
        _pause();
    }

    function unpauseContract() public onlyRole(COMPLIANCE_ROLE) {
        _unpause();
    }

    function setURI(string memory newuri) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _setURI(newuri);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function _beforeTokenTransfer(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    )
        internal
        override(ERC1155Supply)
        whenNotPaused()
    {
        super._beforeTokenTransfer(operator, from, to, ids, amounts, data);
    }
}