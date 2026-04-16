// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract CorporateTreasury is ERC20, ERC20Burnable, ERC20Pausable, AccessControl, Ownable {
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant TREASURY_OPERATOR_ROLE = keccak256("TREASURY_OPERATOR_ROLE");

    mapping(address => bool) private _blacklist;
    mapping(address => uint256) private _frozenUntil;

    uint256 public constant GRACE_PERIOD = 45 days;
    uint256 public constant INITIAL_SUPPLY = 1_000_000_000 * 10 ** decimals();

    event Blacklisted(address indexed account, bool indexed status);
    event FundsFrozen(address indexed account, uint256 indexed until);
    event FundsReleased(address indexed account);
    event MinterConfigured(address indexed minter, bool indexed allowed);
    event ComplianceHold(address indexed from, address indexed to, uint256 value);

    error BlacklistedAccount(address account);
    error AccountFrozen(address account, uint256 until);
    error ZeroAmount();
    error AccessDenied(address sender);

    constructor(address initialOwner)
        ERC20("JPMC Corporate Treasury", "JPMCT")
        Ownable(initialOwner)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(COMPLIANCE_ROLE, initialOwner);
        _grantRole(TREASURY_OPERATOR_ROLE, initialOwner);

        _mint(initialOwner, INITIAL_SUPPLY);
    }

    modifier notBlacklisted(address account) {
        require(!_blacklist[account], BlacklistedAccount(account));
        _;
    }

    modifier notFrozen(address account) {
        if (_frozenUntil[account] != 0) {
            require(
                block.timestamp >= _frozenUntil[account],
                AccountFrozen(account, _frozenUntil[account])
            );
        }
        _;
    }

    function mint(address to, uint256 amount)
        public
        onlyRole(TREASURY_OPERATOR_ROLE)
    {
        _mint(to, amount);
    }

    function burn(uint256 amount)
        public
        override
        notBlacklisted(_msgSender())
        notFrozen(_msgSender())
    {
        super.burn(amount);
    }

    function burnFrom(address account, uint256 amount)
        public
        override
        notBlacklisted(account)
        notFrozen(account)
    {
        super.burnFrom(account, amount);
    }

    function transfer(address to, uint256 amount)
        public
        override
        notBlacklisted(_msgSender())
        notFrozen(_msgSender())
        notBlacklisted(to)
        notFrozen(to)
        whenNotPaused()
        returns (bool)
    {
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount)
        public
        override
        notBlacklisted(from)
        notFrozen(from)
        notBlacklisted(to)
        notFrozen(to)
        whenNotPaused()
        returns (bool)
    {
        return super.transferFrom(from, to, amount);
    }

    function pause()
        public
        onlyRole(COMPLIANCE_ROLE)
    {
        _pause();
    }

    function unpause()
        public
        onlyRole(COMPLIANCE_ROLE)
    {
        _unpause();
    }

    function addToBlacklist(address account)
        public
        onlyRole(COMPLIANCE_ROLE)
    {
        _blacklist[account] = true;
        emit Blacklisted(account, true);
    }

    function removeFromBlacklist(address account)
        public
        onlyRole(COMPLIANCE_ROLE)
    {
        _blacklist[account] = false;
        emit Blacklisted(account, false);
    }

    function freezeAccount(address account, uint256 duration)
        public
        onlyRole(COMPLIANCE_ROLE)
    {
        require(duration <= GRACE_PERIOD, "Duration exceeds grace period");
        uint256 freezeUntil = block.timestamp + duration;
        _frozenUntil[account] = freezeUntil;
        emit FundsFrozen(account, freezeUntil);
    }

    function releaseAccount(address account)
        public
        onlyRole(COMPLIANCE_ROLE)
    {
        _frozenUntil[account] = 0;
        emit FundsReleased(account);
    }

    function isBlacklisted(address account) public view returns (bool) {
        return _blacklist[account];
    }

    function frozenUntil(address account) public view returns (uint256) {
        return _frozenUntil[account];
    }

    function holdCompliance(
        address from,
        address to,
        uint256 amount,
        bytes calldata complianceData
    )
        public
        onlyRole(COMPLIANCE_ROLE)
        returns (bool)
    {
        require(amount > 0, ZeroAmount());

        if (_blacklist[from]) {
            revert BlacklistedAccount(from);
        }

        if (_frozenUntil[from] != 0 && block.timestamp < _frozenUntil[from]) {
            revert AccountFrozen(from, _frozenUntil[from]);
        }

        _transfer(from, to, amount);
        emit ComplianceHold(from, to, amount);
        return true;
    }

    function pauseForCompliance()
        public
        onlyRole(COMPLIANCE_ROLE)
    {
        _pause();
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(AccessControl, ERC20, ERC20Pausable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}