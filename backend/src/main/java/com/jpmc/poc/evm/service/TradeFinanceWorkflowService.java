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
import org.web3j.abi.datatypes.Utf8String;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.crypto.Credentials;

/**
 * TradeFinance (ERC-1155 invoices) workflows. Banker creates / factors / extends invoices.
 * Liquidation-agent key holds SETTLEMENT_AGENT_ROLE so settle goes through that signer.
 * Compliance pauses / unpauses.
 */
@Service
public class TradeFinanceWorkflowService {

  private final ContractAddresses addresses;
  private final SignerCredentialsProvider signers;
  private final TransactionReceiptService receipts;

  public TradeFinanceWorkflowService(
      ContractAddresses addresses, SignerCredentialsProvider signers, TransactionReceiptService receipts) {
    this.addresses = addresses;
    this.signers = signers;
    this.receipts = receipts;
  }

  public TxReceiptDto createInvoice(
      String receivableParty,
      String payableParty,
      BigInteger amount,
      BigInteger dueDate,
      String invoiceRef,
      BigInteger initialSupply)
      throws Exception {
    Function fn =
        new Function(
            "createInvoice",
            List.of(
                new Address(receivableParty),
                new Address(payableParty),
                new Uint256(amount),
                new Uint256(dueDate),
                new Utf8String(invoiceRef),
                new Uint256(initialSupply)),
            List.of());
    return receipts.submit(banker(), addresses.trade(), FunctionEncoder.encode(fn));
  }

  public TxReceiptDto settleInvoice(BigInteger invoiceId, BigInteger amount) throws Exception {
    Function fn =
        new Function(
            "settleInvoice", List.of(new Uint256(invoiceId), new Uint256(amount)), List.of());
    return receipts.submit(settlementAgent(), addresses.trade(), FunctionEncoder.encode(fn));
  }

  public TxReceiptDto factorInvoice(BigInteger invoiceId, String factor, BigInteger amount)
      throws Exception {
    Function fn =
        new Function(
            "factorInvoice",
            List.of(new Uint256(invoiceId), new Address(factor), new Uint256(amount)),
            List.of());
    return receipts.submit(banker(), addresses.trade(), FunctionEncoder.encode(fn));
  }

  public TxReceiptDto extendDueDate(BigInteger invoiceId, BigInteger newDueDate) throws Exception {
    Function fn =
        new Function(
            "extendDueDate",
            List.of(new Uint256(invoiceId), new Uint256(newDueDate)),
            List.of());
    return receipts.submit(banker(), addresses.trade(), FunctionEncoder.encode(fn));
  }

  public TxReceiptDto pause() throws Exception {
    Function fn = new Function("pauseContract", List.of(), List.of());
    return receipts.submit(compliance(), addresses.trade(), FunctionEncoder.encode(fn));
  }

  public TxReceiptDto unpause() throws Exception {
    Function fn = new Function("unpauseContract", List.of(), List.of());
    return receipts.submit(compliance(), addresses.trade(), FunctionEncoder.encode(fn));
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

  private Credentials settlementAgent() {
    return signers
        .liquidationAgent()
        .orElseThrow(
            () ->
                new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE, "liquidation/settlement signer not configured"));
  }
}
