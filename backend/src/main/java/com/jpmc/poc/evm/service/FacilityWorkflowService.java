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
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.crypto.Credentials;

/**
 * CollateralizedFacility workflows. Compliance escalates / releases / commences liquidation;
 * the liquidation agent finalizes; the banker (acting as borrower in the demo seed) tops up cash.
 */
@Service
public class FacilityWorkflowService {

  private final ContractAddresses addresses;
  private final SignerCredentialsProvider signers;
  private final TransactionReceiptService receipts;

  public FacilityWorkflowService(
      ContractAddresses addresses, SignerCredentialsProvider signers, TransactionReceiptService receipts) {
    this.addresses = addresses;
    this.signers = signers;
    this.receipts = receipts;
  }

  public TxReceiptDto applyComplianceHold(long facilityId) throws Exception {
    Function fn =
        new Function(
            "applyComplianceHold", List.of(new Uint256(BigInteger.valueOf(facilityId))), List.of());
    return receipts.submit(compliance(), addresses.facility(), FunctionEncoder.encode(fn));
  }

  public TxReceiptDto releaseComplianceHold(long facilityId) throws Exception {
    Function fn =
        new Function(
            "releaseComplianceHold",
            List.of(new Uint256(BigInteger.valueOf(facilityId))),
            List.of());
    return receipts.submit(compliance(), addresses.facility(), FunctionEncoder.encode(fn));
  }

  public TxReceiptDto commenceLiquidation(long facilityId) throws Exception {
    Function fn =
        new Function(
            "commenceLiquidation",
            List.of(new Uint256(BigInteger.valueOf(facilityId))),
            List.of());
    return receipts.submit(compliance(), addresses.facility(), FunctionEncoder.encode(fn));
  }

  public TxReceiptDto finalizeLiquidation(long facilityId, String recoveryAddress) throws Exception {
    Function fn =
        new Function(
            "finalizeLiquidation",
            List.of(new Uint256(BigInteger.valueOf(facilityId)), new Address(recoveryAddress)),
            List.of());
    return receipts.submit(liquidationAgent(), addresses.facility(), FunctionEncoder.encode(fn));
  }

  public TxReceiptDto topUpCash(long facilityId, BigInteger amount) throws Exception {
    Function fn =
        new Function(
            "topUpCash",
            List.of(new Uint256(BigInteger.valueOf(facilityId)), new Uint256(amount)),
            List.of());
    return receipts.submit(banker(), addresses.facility(), FunctionEncoder.encode(fn));
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

  private Credentials liquidationAgent() {
    return signers
        .liquidationAgent()
        .orElseThrow(
            () ->
                new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "liquidation agent signer not configured"));
  }
}
