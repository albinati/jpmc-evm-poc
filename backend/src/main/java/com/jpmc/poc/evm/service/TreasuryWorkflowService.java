package com.jpmc.poc.evm.service;

import com.jpmc.poc.evm.config.ContractAddresses;
import com.jpmc.poc.evm.key.SignerCredentialsProvider;
import com.jpmc.poc.evm.web.dto.TxReceiptDto;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.Bool;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.generated.Bytes32;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.crypto.Credentials;

/**
 * Treasury (ERC-20 + compliance) workflows. Mint uses TREASURY_OPERATOR_ROLE (banker key);
 * everything else uses COMPLIANCE_ROLE (compliance key).
 */
@Service
public class TreasuryWorkflowService {

  private final ContractAddresses addresses;
  private final SignerCredentialsProvider signers;
  private final TransactionReceiptService receipts;

  public TreasuryWorkflowService(
      ContractAddresses addresses, SignerCredentialsProvider signers, TransactionReceiptService receipts) {
    this.addresses = addresses;
    this.signers = signers;
    this.receipts = receipts;
  }

  public TxReceiptDto mint(String to, BigInteger amount) throws Exception {
    Function fn = new Function("mint", List.of(new Address(to), new Uint256(amount)), List.of());
    return receipts.submit(banker(), addresses.treasury(), FunctionEncoder.encode(fn));
  }

  public TxReceiptDto setBlacklist(String address, boolean on) throws Exception {
    String name = on ? "addToBlacklist" : "removeFromBlacklist";
    Function fn = new Function(name, List.of(new Address(address)), List.of());
    return receipts.submit(compliance(), addresses.treasury(), FunctionEncoder.encode(fn));
  }

  public TxReceiptDto freeze(String address, BigInteger durationSeconds) throws Exception {
    Function fn =
        new Function(
            "freezeAccount", List.of(new Address(address), new Uint256(durationSeconds)), List.of());
    return receipts.submit(compliance(), addresses.treasury(), FunctionEncoder.encode(fn));
  }

  public TxReceiptDto release(String address) throws Exception {
    Function fn = new Function("releaseAccount", List.of(new Address(address)), List.of());
    return receipts.submit(compliance(), addresses.treasury(), FunctionEncoder.encode(fn));
  }

  public TxReceiptDto pause() throws Exception {
    Function fn = new Function("pause", List.of(), List.of());
    return receipts.submit(compliance(), addresses.treasury(), FunctionEncoder.encode(fn));
  }

  public TxReceiptDto unpause() throws Exception {
    Function fn = new Function("unpause", List.of(), List.of());
    return receipts.submit(compliance(), addresses.treasury(), FunctionEncoder.encode(fn));
  }

  public TxReceiptDto forceTransfer(String from, String to, BigInteger amount, String reason)
      throws Exception {
    byte[] reasonBytes = encodeReason(reason);
    Function fn =
        new Function(
            "forceTransfer",
            List.of(new Address(from), new Address(to), new Uint256(amount), new Bytes32(reasonBytes)),
            List.of());
    return receipts.submit(compliance(), addresses.treasury(), FunctionEncoder.encode(fn));
  }

  static byte[] encodeReason(String reason) {
    byte[] padded = new byte[32];
    if (reason == null || reason.isBlank()) {
      return padded;
    }
    String trimmed = reason.startsWith("0x") ? reason.substring(2) : reason;
    if (trimmed.matches("[0-9a-fA-F]+") && trimmed.length() <= 64) {
      byte[] decoded = new byte[trimmed.length() / 2];
      for (int i = 0; i < trimmed.length(); i += 2) {
        decoded[i / 2] =
            (byte) ((Character.digit(trimmed.charAt(i), 16) << 4) + Character.digit(trimmed.charAt(i + 1), 16));
      }
      System.arraycopy(decoded, 0, padded, 0, Math.min(decoded.length, 32));
      return padded;
    }
    byte[] utf8 = reason.getBytes(StandardCharsets.UTF_8);
    System.arraycopy(utf8, 0, padded, 0, Math.min(utf8.length, 32));
    return padded;
  }

  private Credentials banker() {
    return signers
        .banker()
        .orElseThrow(
            () -> new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "banker signer not configured"));
  }

  private Credentials compliance() {
    return signers
        .compliance()
        .orElseThrow(
            () ->
                new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "compliance signer not configured"));
  }

}
