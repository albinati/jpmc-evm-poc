// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title CompliantTreasury
 * @dev Enterprise-grade ERC20 token demonstrating corporate treasury controls.
 * Features: Role-based access control, pausable for emergencies, and KYC/AML blacklisting.
 */
contract CompliantTreasury is ERC20, ERC20Pausable, AccessControl {
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    
    // KYC/AML Compliance: addresses mapped to freeze status
    mapping(address => bool) public isBlacklisted;

    event AccountFrozen(address indexed account);
    event AccountUnfrozen(address indexed account);

    constructor(address defaultAdmin) ERC20("JPMC Corporate GBP", "JGBPT") {
        _grantRole(DEFAULT_ADMIN_ROLE, defaultAdmin);
        _grantRole(COMPLIANCE_ROLE, defaultAdmin);
        
        // Mint initial liquidity to the treasury (1 Billion tokens)
        _mint(defaultAdmin, 1000000000 * 10 ** decimals());
    }

    /**
     * @dev Freezes a defaulting or suspicious client's funds.
     */
    function freezeAccount(address account) external onlyRole(COMPLIANCE_ROLE) {
        isBlacklisted[account] = true;
        emit AccountFrozen(account);
    }

    /**
     * @dev Unfreezes a client's funds after compliance clearance.
     */
    function unfreezeAccount(address account) external onlyRole(COMPLIANCE_ROLE) {
        isBlacklisted[account] = false;
        emit AccountUnfrozen(account);
    }

    /**
     * @dev Pauses all token transfers globally in case of a critical exploit or regulatory halt.
     */
    function pauseTreasury() external onlyRole(COMPLIANCE_ROLE) {
        _pause();
    }

    function unpauseTreasury() external onlyRole(COMPLIANCE_ROLE) {
        _unpause();
    }

    /**
     * @dev Overrides the standard ERC20 update to enforce the blacklist and pause mechanics.
     */
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        require(!isBlacklisted[from], "Compliance: Sender funds are frozen");
        require(!isBlacklisted[to], "Compliance: Receiver is blacklisted");
        super._update(from, to, value);
    }
}
