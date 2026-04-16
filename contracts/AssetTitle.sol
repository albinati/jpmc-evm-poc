// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AssetTitle
 * @dev Replaces physical collateral (title deeds, loans) with immutable NFTs.
 * Designed for private enterprise chains where the bank retains ultimate authority.
 */
contract AssetTitle is ERC721, Ownable {
    uint256 private _nextTokenId;

    // Maps token ID to a secure hash of the legal document (e.g., hosted on private AWS/GCP buckets)
    mapping(uint256 => string) public assetDocumentURI;

    constructor(address initialOwner)
        ERC721("JPMC RWA Title", "JRWA")
        Ownable(initialOwner)
    {}

    /**
     * @dev Issues a new digital title deed to a verified client.
     */
    function issueTitle(address client, string memory documentURI) public onlyOwner {
        uint256 tokenId = _nextTokenId++;
        assetDocumentURI[tokenId] = documentURI;
        _safeMint(client, tokenId);
    }

    /**
     * @dev The bank retains the right to burn/revoke the asset in the event of default
     * or a court order. This is a critical requirement for enterprise RWA.
     */
    function revokeTitle(uint256 tokenId) public onlyOwner {
        _burn(tokenId);
        delete assetDocumentURI[tokenId];
    }
}
