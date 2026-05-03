package com.jpmc.poc.evm.service;

import com.jpmc.poc.evm.config.ContractAddresses;
import com.jpmc.poc.evm.key.SignerCredentialsProvider;
import com.jpmc.poc.evm.web.dto.TxReceiptDto;
import java.math.BigInteger;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.Bool;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.Utf8String;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.crypto.Credentials;

/**
 * TitleTokenization (ERC-721) workflows. Mint / encumber / qualified-buyer / URI updates use the
 * compliance signer (COMPLIANCE_OFFICER_ROLE). Transfer uses the banker signer
 * (TRANSFER_AGENT_ROLE).
 */
@Service
public class TitleWorkflowService {

  private final ContractAddresses addresses;
  private final SignerCredentialsProvider signers;
  private final TransactionReceiptService receipts;

  public TitleWorkflowService(
      ContractAddresses addresses, SignerCredentialsProvider signers, TransactionReceiptService receipts) {
    this.addresses = addresses;
    this.signers = signers;
    this.receipts = receipts;
  }

  public TxReceiptDto mintTitle(
      String to,
      BigInteger tokenId,
      String tokenURI,
      String propertyAddress,
      BigInteger salePrice,
      String jurisdiction)
      throws Exception {
    Function fn =
        new Function(
            "mintTitle",
            List.of(
                new Address(to),
                new Uint256(tokenId),
                new Utf8String(tokenURI),
                new Address(propertyAddress),
                new Uint256(salePrice),
                new Utf8String(jurisdiction)),
            List.of());
    return receipts.submit(compliance(), addresses.title(), FunctionEncoder.encode(fn));
  }

  public TxReceiptDto setEncumbrance(BigInteger tokenId, boolean on) throws Exception {
    Function fn =
        new Function(
            "setEncumbrance", List.of(new Uint256(tokenId), new Bool(on)), List.of());
    return receipts.submit(compliance(), addresses.title(), FunctionEncoder.encode(fn));
  }

  public TxReceiptDto setQualifiedBuyer(String address, boolean on) throws Exception {
    Function fn =
        new Function(
            "setQualifiedBuyer", List.of(new Address(address), new Bool(on)), List.of());
    return receipts.submit(compliance(), addresses.title(), FunctionEncoder.encode(fn));
  }

  public TxReceiptDto updateTokenURI(BigInteger tokenId, String uri) throws Exception {
    Function fn =
        new Function("updateTokenURI", List.of(new Uint256(tokenId), new Utf8String(uri)), List.of());
    return receipts.submit(compliance(), addresses.title(), FunctionEncoder.encode(fn));
  }

  public TxReceiptDto transferTitle(String from, String to, BigInteger tokenId) throws Exception {
    Function fn =
        new Function(
            "safeTransferTitle",
            List.of(new Address(from), new Address(to), new Uint256(tokenId)),
            List.of());
    return receipts.submit(banker(), addresses.title(), FunctionEncoder.encode(fn));
  }

  private Credentials compliance() {
    return signers
        .compliance()
        .orElseThrow(
            () ->
                new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "compliance signer not configured"));
  }

  private Credentials banker() {
    return signers
        .banker()
        .orElseThrow(
            () -> new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "banker signer not configured"));
  }
}
