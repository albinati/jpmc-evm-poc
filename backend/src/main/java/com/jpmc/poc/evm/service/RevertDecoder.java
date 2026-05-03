package com.jpmc.poc.evm.service;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import org.web3j.crypto.Hash;

/**
 * Maps the 4-byte selectors of every Solidity custom error this POC can emit (plus the
 * relevant OpenZeppelin and ERC-20/721/1155 ones) back to their human-readable signatures so
 * the UI sees "AccessControlUnauthorizedAccount" instead of "0xe2517d3f...".
 */
public final class RevertDecoder {

  private static final Map<String, String> SELECTOR_TO_SIGNATURE = build();

  private RevertDecoder() {}

  public static String decode(String revertHex) {
    if (revertHex == null) return null;
    String hex = revertHex.startsWith("0x") ? revertHex.substring(2) : revertHex;
    if (hex.length() < 8) return null;
    String selector = hex.substring(0, 8).toLowerCase(Locale.ROOT);
    return SELECTOR_TO_SIGNATURE.get(selector);
  }

  private static Map<String, String> build() {
    Map<String, String> m = new HashMap<>();
    String[] sigs = {
      // OpenZeppelin AccessControl
      "AccessControlUnauthorizedAccount(address,bytes32)",
      "AccessControlBadConfirmation()",
      // OpenZeppelin Pausable
      "EnforcedPause()",
      "ExpectedPause()",
      // OpenZeppelin Ownable
      "OwnableUnauthorizedAccount(address)",
      "OwnableInvalidOwner(address)",
      // ERC-20
      "ERC20InsufficientBalance(address,uint256,uint256)",
      "ERC20InsufficientAllowance(address,address,uint256,uint256)",
      "ERC20InvalidSender(address)",
      "ERC20InvalidReceiver(address)",
      "ERC20InvalidApprover(address)",
      "ERC20InvalidSpender(address)",
      // ERC-721
      "ERC721NonexistentToken(uint256)",
      "ERC721InvalidOwner(address)",
      "ERC721IncorrectOwner(address,uint256,address)",
      "ERC721InsufficientApproval(address,uint256)",
      "ERC721InvalidSender(address)",
      "ERC721InvalidReceiver(address)",
      // ERC-1155
      "ERC1155InsufficientBalance(address,uint256,uint256,uint256)",
      "ERC1155InvalidSender(address)",
      "ERC1155InvalidReceiver(address)",
      "ERC1155MissingApprovalForAll(address,address)",
      // ReentrancyGuard
      "ReentrancyGuardReentrantCall()",
      // CorporateTreasury
      "BlacklistedAccount(address)",
      "AccountFrozen(address,uint256)",
      "ZeroAmount()",
      "AccessDenied(address)",
      "InvalidSeizureParticipants()",
      // TitleTokenization
      "NotQualifiedBuyer(address)",
      "EncumberedTitle(uint256)",
      "UnauthorizedCaller(address)",
      "InvalidPropertyAddress(address)",
      "TitleDoesNotExist(uint256)",
      // TradeFinance
      "InvalidAmount(uint256)",
      "InvoiceAlreadySettled(uint256)",
      "InvoiceExpired(uint256,uint256)",
      "DuplicateReference(string)",
      "InvalidParty(address)",
      "InvoiceNotFound(uint256)",
      "PartialSettlementLimit(uint256,uint256)",
      "DueDateNotInFuture(uint256,uint256)",
      "DueDateNotAnExtension(uint256,uint256)",
      // CollateralizedFacility
      "InvalidState(uint256,uint8,string)",
      "NotBorrower(uint256,address)",
      "ZeroAddress()",
      "TitleTokenMismatch(uint256,uint256,uint256)",
      // Solidity built-ins
      "Error(string)",
      "Panic(uint256)",
    };
    for (String sig : sigs) {
      String sel = selectorOf(sig);
      m.put(sel, sig);
    }
    return Map.copyOf(m);
  }

  private static String selectorOf(String signature) {
    byte[] hash = Hash.sha3(signature.getBytes());
    StringBuilder sb = new StringBuilder(8);
    for (int i = 0; i < 4; i++) sb.append(String.format("%02x", hash[i]));
    return sb.toString();
  }
}
