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
        string invoiceReference;
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
        string invoiceRef
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
    event InvoiceDueDateExtended(
        uint256 indexed invoiceId,
        uint256 oldDueDate,
        uint256 newDueDate,
        address indexed by
    );

    error InvalidAmount(uint256 amount);
    error InvoiceAlreadySettled(uint256 invoiceId);
    error InvoiceExpired(uint256 invoiceId, uint256 dueDate);
    error DuplicateReference(string invoiceRef);
    error InvalidParty(address party);
    error InvoiceNotFound(uint256 invoiceId);
    error PartialSettlementLimit(uint256 remaining, uint256 requested);
    error DueDateNotInFuture(uint256 newDueDate, uint256 nowTs);
    error DueDateNotAnExtension(uint256 oldDueDate, uint256 newDueDate);

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
        string memory invoiceRef,
        uint256 initialSupply
    )
        public
        onlyRole(BANKER_ROLE)
        returns (uint256)
    {
        if (receivableParty == address(0)) {
            revert InvalidParty(receivableParty);
        }
        if (payableParty == address(0)) {
            revert InvalidParty(payableParty);
        }
        if (amount == 0 || amount > MAX_INVOICE_AMOUNT) {
            revert InvalidAmount(amount);
        }
        if (_referenceToInvoiceId[invoiceRef] != 0) {
            revert DuplicateReference(invoiceRef);
        }

        uint256 invoiceId = _nextInvoiceId++;

        _invoices[invoiceId] = Invoice({
            receivableParty: receivableParty,
            payableParty: payableParty,
            amount: amount,
            dueDate: dueDate,
            settled: false,
            invoiceReference: invoiceRef
        });

        _referenceToInvoiceId[invoiceRef] = invoiceId;
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
            invoiceRef
        );

        return invoiceId;
    }

    function settleInvoice(uint256 invoiceId, uint256 amount)
        public
        whenNotPaused()
        onlyRole(SETTLEMENT_AGENT_ROLE)
    {
        Invoice storage invoice = _invoices[invoiceId];
        if (invoice.settled) {
            revert InvoiceAlreadySettled(invoiceId);
        }

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
        if (invoice.settled) {
            revert InvoiceAlreadySettled(invoiceId);
        }
        if (factor == address(0)) {
            revert InvalidParty(factor);
        }

        uint256 currentSupply = supplyOf(invoiceId);
        if (amount > currentSupply) {
            revert InvalidAmount(amount);
        }

        _safeTransferFrom(invoice.receivableParty, factor, invoiceId, amount, "");

        emit InvoiceFactored(invoiceId, factor, amount);
    }

    function factorFullInvoice(uint256 invoiceId, address factor)
        public
        onlyRole(BANKER_ROLE)
    {
        Invoice storage invoice = _invoices[invoiceId];
        if (invoice.settled) {
            revert InvoiceAlreadySettled(invoiceId);
        }
        if (factor == address(0)) {
            revert InvalidParty(factor);
        }

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

    /// @notice Flat-tuple alternative for RPC clients that cannot decode Solidity struct returns (e.g. Web3j).
    function getInvoiceParts(uint256 invoiceId)
        public
        view
        returns (
            address receivableParty,
            address payableParty,
            uint256 amount,
            uint256 dueDate,
            bool settled,
            uint256 currentSupply,
            string memory invoiceReference
        )
    {
        Invoice memory inv = _invoices[invoiceId];
        return (
            inv.receivableParty,
            inv.payableParty,
            inv.amount,
            inv.dueDate,
            inv.settled,
            totalSupply(invoiceId),
            inv.invoiceReference
        );
    }

    /// @notice Banker can extend an unsettled invoice's due date further into the future.
    /// Cannot shrink the existing date and cannot land in the past.
    function extendDueDate(uint256 invoiceId, uint256 newDueDate)
        public
        onlyRole(BANKER_ROLE)
    {
        Invoice storage invoice = _invoices[invoiceId];
        if (invoice.receivableParty == address(0)) {
            revert InvoiceNotFound(invoiceId);
        }
        if (invoice.settled) {
            revert InvoiceAlreadySettled(invoiceId);
        }
        if (newDueDate <= block.timestamp) {
            revert DueDateNotInFuture(newDueDate, block.timestamp);
        }
        if (newDueDate <= invoice.dueDate) {
            revert DueDateNotAnExtension(invoice.dueDate, newDueDate);
        }

        uint256 oldDueDate = invoice.dueDate;
        invoice.dueDate = newDueDate;
        emit InvoiceDueDateExtended(invoiceId, oldDueDate, newDueDate, _msgSender());
    }

    function getPartyInvoices(address party)
        public
        view
        returns (uint256[] memory)
    {
        return _partyInvoices[party];
    }

    function getInvoiceByReference(string memory invoiceRef)
        public
        view
        returns (uint256)
    {
        return _referenceToInvoiceId[invoiceRef];
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

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override(ERC1155, ERC1155Supply) whenNotPaused {
        super._update(from, to, ids, values);
    }
}