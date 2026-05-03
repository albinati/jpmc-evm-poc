// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract TitleTokenization is ERC721, ERC721URIStorage, ERC721Burnable, AccessControl, Ownable {
    bytes32 public constant COMPLIANCE_OFFICER_ROLE = keccak256("COMPLIANCE_OFFICER_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");
    bytes32 public constant TRANSFER_AGENT_ROLE = keccak256("TRANSFER_AGENT_ROLE");

    struct TitleDetail {
        address propertyAddress;
        uint256 lastSalePrice;
        uint256 lastSaleTimestamp;
        bool isEncumbered;
        string jurisdiction;
    }

    mapping(uint256 => TitleDetail) private _titleDetails;
    mapping(address => bool) private _qualifiedBuyers;

    event TitleMinted(uint256 tokenId, address indexed propertyAddress, string jurisdiction);
    event TitleTransferred(uint256 tokenId, address indexed from, address indexed to);
    event TitleEncumbered(uint256 tokenId, bool indexed isEncumbered);
    event BuyerQualified(address indexed account, bool indexed qualified);
    event TokenURIUpdated(uint256 indexed tokenId, string newURI, address indexed updatedBy);

    error NotQualifiedBuyer(address account);
    error EncumberedTitle(uint256 tokenId);
    error UnauthorizedCaller(address caller);
    error InvalidPropertyAddress(address propertyAddress);
    error TitleDoesNotExist(uint256 tokenId);

    constructor(address initialOwner)
        ERC721("PropertyTitle", "PTLE")
        Ownable(initialOwner)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(COMPLIANCE_OFFICER_ROLE, initialOwner);
        _grantRole(TRANSFER_AGENT_ROLE, initialOwner);
    }

    function mintTitle(
        address to,
        uint256 tokenId,
        string memory tokenURI_,
        address propertyAddress,
        uint256 salePrice,
        string memory jurisdiction
    ) public onlyRole(COMPLIANCE_OFFICER_ROLE) {
        if (propertyAddress == address(0)) {
            revert InvalidPropertyAddress(propertyAddress);
        }

        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI_);

        _titleDetails[tokenId] = TitleDetail({
            propertyAddress: propertyAddress,
            lastSalePrice: salePrice,
            lastSaleTimestamp: block.timestamp,
            isEncumbered: false,
            jurisdiction: jurisdiction
        });

        emit TitleMinted(tokenId, propertyAddress, jurisdiction);
    }

    function safeTransferTitle(
        address from,
        address to,
        uint256 tokenId
    ) public onlyRole(TRANSFER_AGENT_ROLE) {
        if (_titleDetails[tokenId].isEncumbered) {
            revert EncumberedTitle(tokenId);
        }
        _safeTransfer(from, to, tokenId, "");
        _titleDetails[tokenId].lastSaleTimestamp = block.timestamp;

        emit TitleTransferred(tokenId, from, to);
    }

    function setEncumbrance(uint256 tokenId, bool encumbered)
        public
        onlyRole(COMPLIANCE_OFFICER_ROLE)
    {
        _titleDetails[tokenId].isEncumbered = encumbered;
        emit TitleEncumbered(tokenId, encumbered);
    }

    function setQualifiedBuyer(address account, bool qualified)
        public
        onlyRole(COMPLIANCE_OFFICER_ROLE)
    {
        _qualifiedBuyers[account] = qualified;
        emit BuyerQualified(account, qualified);
    }

    function getTitleDetail(uint256 tokenId)
        public
        view
        returns (TitleDetail memory)
    {
        return _titleDetails[tokenId];
    }

    /// @notice Flat-tuple alternative for RPC clients that cannot decode struct returns (e.g. Web3j).
    function getTitleDetailParts(uint256 tokenId)
        public
        view
        returns (
            address owner,
            string memory uri,
            address propertyAddress,
            uint256 lastSalePrice,
            uint256 lastSaleTimestamp,
            bool isEncumbered,
            string memory jurisdiction
        )
    {
        TitleDetail memory d = _titleDetails[tokenId];
        owner = _ownerOf(tokenId);
        uri = owner == address(0) ? "" : tokenURI(tokenId);
        return (
            owner,
            uri,
            d.propertyAddress,
            d.lastSalePrice,
            d.lastSaleTimestamp,
            d.isEncumbered,
            d.jurisdiction
        );
    }

    /// @notice Compliance can amend the off-chain metadata pointer for an existing title.
    function updateTokenURI(uint256 tokenId, string calldata newURI)
        public
        onlyRole(COMPLIANCE_OFFICER_ROLE)
    {
        if (_ownerOf(tokenId) == address(0)) {
            revert TitleDoesNotExist(tokenId);
        }
        _setTokenURI(tokenId, newURI);
        emit TokenURIUpdated(tokenId, newURI, _msgSender());
    }

    function isQualifiedBuyer(address account) public view returns (bool) {
        return _qualifiedBuyers[account];
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}