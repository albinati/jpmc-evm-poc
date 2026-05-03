// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title CollateralizedFacility
/// @notice Kinexys-style POC: escrow JPMD-analog (ERC-20) and optional RWA title (ERC-721) with compliance hold and liquidation paths.
contract CollateralizedFacility is AccessControl, ReentrancyGuard, ERC721Holder {
    using SafeERC20 for IERC20;

    bytes32 public constant FACILITY_BANKER_ROLE = keccak256("FACILITY_BANKER_ROLE");
    bytes32 public constant COMPLIANCE_ROLE = keccak256("COMPLIANCE_ROLE");
    bytes32 public constant LIQUIDATION_AGENT_ROLE = keccak256("LIQUIDATION_AGENT_ROLE");

    IERC20 public immutable cashToken;
    IERC721 public immutable titleToken;

    enum FacilityState {
        Draft,
        Active,
        ComplianceHold,
        Liquidation,
        Closed
    }

    struct Facility {
        address borrower;
        FacilityState state;
        uint256 lockedCash;
        uint256 titleTokenId;
        uint256 tradeFinanceRefId;
    }

    mapping(uint256 => Facility) private _facilities;
    uint256 private _nextFacilityId;

    event FacilityCreated(uint256 indexed facilityId, address indexed borrower, uint256 tradeFinanceRefId);
    event FacilityFunded(
        uint256 indexed facilityId,
        address indexed borrower,
        uint256 cashAmount,
        uint256 titleTokenId
    );
    event ComplianceHoldApplied(uint256 indexed facilityId, address indexed actor);
    event ComplianceHoldReleased(uint256 indexed facilityId, address indexed actor);
    event LiquidationCommenced(uint256 indexed facilityId, address indexed actor);
    event LiquidationFinalized(
        uint256 indexed facilityId,
        address indexed recovery,
        uint256 cashTransferred,
        uint256 titleTokenIdTransferred
    );
    event FacilityReleasedNormally(uint256 indexed facilityId, address indexed borrower);
    event CashToppedUp(
        uint256 indexed facilityId,
        address indexed borrower,
        uint256 amount,
        uint256 newLockedCash
    );

    error InvalidState(uint256 facilityId, FacilityState current, string message);
    error NotBorrower(uint256 facilityId, address caller);
    error ZeroAddress();
    error TitleTokenMismatch(uint256 facilityId, uint256 provided, uint256 expected);
    error ZeroAmount();

    constructor(address admin, IERC20 cashToken_, IERC721 titleToken_) {
        if (admin == address(0)) revert ZeroAddress();
        cashToken = cashToken_;
        titleToken = titleToken_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(FACILITY_BANKER_ROLE, admin);
        _grantRole(COMPLIANCE_ROLE, admin);
        _grantRole(LIQUIDATION_AGENT_ROLE, admin);
    }

    function nextFacilityId() external view returns (uint256) {
        return _nextFacilityId;
    }

    function getFacility(uint256 facilityId) external view returns (Facility memory) {
        return _facilities[facilityId];
    }

    /// @notice Flat return for RPC clients that cannot decode Solidity struct tuples (e.g. Web3j).
    function getFacilityParts(uint256 facilityId)
        external
        view
        returns (
            address borrower,
            uint8 state,
            uint256 lockedCash,
            uint256 titleTokenId,
            uint256 tradeFinanceRefId
        )
    {
        Facility memory f = _facilities[facilityId];
        return (f.borrower, uint8(f.state), f.lockedCash, f.titleTokenId, f.tradeFinanceRefId);
    }

    /// @notice Banker opens a facility shell; borrower funds it in a separate step.
    function createFacility(address borrower, uint256 tradeFinanceRefId)
        external
        onlyRole(FACILITY_BANKER_ROLE)
        returns (uint256 facilityId)
    {
        if (borrower == address(0)) revert ZeroAddress();
        facilityId = ++_nextFacilityId;
        _facilities[facilityId] = Facility({
            borrower: borrower,
            state: FacilityState.Draft,
            lockedCash: 0,
            titleTokenId: 0,
            tradeFinanceRefId: tradeFinanceRefId
        });
        emit FacilityCreated(facilityId, borrower, tradeFinanceRefId);
    }

    /// @notice Borrower posts cash (approve first) and optionally transfers a title NFT into the facility.
    function fundAndEncumber(uint256 facilityId, uint256 cashAmount, uint256 titleTokenId_)
        external
        nonReentrant
    {
        Facility storage f = _facilities[facilityId];
        if (f.borrower != msg.sender) revert NotBorrower(facilityId, msg.sender);
        if (f.state != FacilityState.Draft) {
            revert InvalidState(facilityId, f.state, "not Draft");
        }

        if (cashAmount > 0) {
            cashToken.safeTransferFrom(msg.sender, address(this), cashAmount);
            f.lockedCash += cashAmount;
        }

        if (titleTokenId_ != 0) {
            titleToken.safeTransferFrom(msg.sender, address(this), titleTokenId_);
            f.titleTokenId = titleTokenId_;
        }

        f.state = FacilityState.Active;
        emit FacilityFunded(facilityId, msg.sender, cashAmount, titleTokenId_);
    }

    function applyComplianceHold(uint256 facilityId) external onlyRole(COMPLIANCE_ROLE) nonReentrant {
        Facility storage f = _facilities[facilityId];
        if (f.state != FacilityState.Active) {
            revert InvalidState(facilityId, f.state, "not Active");
        }
        f.state = FacilityState.ComplianceHold;
        emit ComplianceHoldApplied(facilityId, msg.sender);
    }

    function releaseComplianceHold(uint256 facilityId) external onlyRole(COMPLIANCE_ROLE) nonReentrant {
        Facility storage f = _facilities[facilityId];
        if (f.state != FacilityState.ComplianceHold) {
            revert InvalidState(facilityId, f.state, "not ComplianceHold");
        }
        f.state = FacilityState.Active;
        emit ComplianceHoldReleased(facilityId, msg.sender);
    }

    function commenceLiquidation(uint256 facilityId) external onlyRole(COMPLIANCE_ROLE) nonReentrant {
        Facility storage f = _facilities[facilityId];
        if (f.state != FacilityState.Active && f.state != FacilityState.ComplianceHold) {
            revert InvalidState(facilityId, f.state, "cannot liquidate from this state");
        }
        f.state = FacilityState.Liquidation;
        emit LiquidationCommenced(facilityId, msg.sender);
    }

    /// @notice Sends all escrowed cash and the title NFT (if any) to a recovery / treasury address.
    function finalizeLiquidation(uint256 facilityId, address recovery) external onlyRole(LIQUIDATION_AGENT_ROLE) nonReentrant {
        if (recovery == address(0)) revert ZeroAddress();
        Facility storage f = _facilities[facilityId];
        if (f.state != FacilityState.Liquidation) {
            revert InvalidState(facilityId, f.state, "not Liquidation");
        }

        uint256 cashOut = f.lockedCash;
        uint256 tid = f.titleTokenId;

        f.lockedCash = 0;
        f.titleTokenId = 0;
        f.state = FacilityState.Closed;

        if (cashOut > 0) {
            cashToken.safeTransfer(recovery, cashOut);
        }
        if (tid != 0) {
            titleToken.safeTransferFrom(address(this), recovery, tid);
        }

        emit LiquidationFinalized(facilityId, recovery, cashOut, tid);
    }

    /// @notice Borrower amends an Active facility by posting more cash collateral.
    function topUpCash(uint256 facilityId, uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        Facility storage f = _facilities[facilityId];
        if (f.borrower != msg.sender) revert NotBorrower(facilityId, msg.sender);
        if (f.state != FacilityState.Active) {
            revert InvalidState(facilityId, f.state, "not Active");
        }

        cashToken.safeTransferFrom(msg.sender, address(this), amount);
        f.lockedCash += amount;
        emit CashToppedUp(facilityId, msg.sender, amount, f.lockedCash);
    }

    /// @notice Obligation satisfied: return collateral to borrower.
    function releaseFacility(uint256 facilityId) external onlyRole(FACILITY_BANKER_ROLE) nonReentrant {
        Facility storage f = _facilities[facilityId];
        if (f.state != FacilityState.Active) {
            revert InvalidState(facilityId, f.state, "not Active");
        }
        address borrower = f.borrower;
        uint256 cashOut = f.lockedCash;
        uint256 tid = f.titleTokenId;

        f.lockedCash = 0;
        f.titleTokenId = 0;
        f.state = FacilityState.Closed;

        if (cashOut > 0) {
            cashToken.safeTransfer(borrower, cashOut);
        }
        if (tid != 0) {
            titleToken.safeTransferFrom(address(this), borrower, tid);
        }

        emit FacilityReleasedNormally(facilityId, borrower);
    }

    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
