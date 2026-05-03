package com.jpmc.poc.evm.service;

import com.jpmc.poc.evm.config.DeploymentAddresses.DeploymentFile;
import com.jpmc.poc.evm.web.dto.TxReceiptDto;
import java.math.BigInteger;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.web3j.crypto.Credentials;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.core.methods.response.EthCall;
import org.web3j.protocol.core.methods.response.EthSendTransaction;
import org.web3j.protocol.core.methods.response.TransactionReceipt;
import org.web3j.protocol.exceptions.TransactionException;
import org.web3j.tx.RawTransactionManager;
import org.web3j.tx.gas.DefaultGasProvider;

/**
 * Submits signed transactions, waits for the receipt, and decodes event logs into a UI-friendly
 * shape. Simulates the call first via eth_call so reverts surface as 400s with the decoded
 * Solidity custom-error name rather than as opaque server errors.
 */
@Service
public class TransactionReceiptService {

  private static final int RECEIPT_POLL_ATTEMPTS = 30;
  private static final long RECEIPT_POLL_DELAY_MS = 500L;

  private final Web3j web3j;
  private final long chainId;
  private final EventCatalog catalog;

  public TransactionReceiptService(Web3j web3j, DeploymentFile deploymentFile, EventCatalog catalog) {
    this.web3j = web3j;
    this.chainId = deploymentFile.chainId();
    this.catalog = catalog;
  }

  public TxReceiptDto submit(Credentials credentials, String to, String encodedFn)
      throws Exception {
    return submit(credentials, to, encodedFn, BigInteger.ZERO);
  }

  public TxReceiptDto submit(Credentials credentials, String to, String encodedFn, BigInteger value)
      throws Exception {

    EthCall simulation =
        web3j
            .ethCall(
                Transaction.createFunctionCallTransaction(
                    credentials.getAddress(), null, null, null, to, value, encodedFn),
                DefaultBlockParameterName.LATEST)
            .send();
    if (simulation.isReverted()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, decodeRevert(simulation.getRevertReason()));
    }
    if (simulation.hasError()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "Simulation error: " + simulation.getError().getMessage());
    }

    RawTransactionManager tm = new RawTransactionManager(web3j, credentials, chainId);
    EthSendTransaction send =
        tm.sendTransaction(
            DefaultGasProvider.GAS_PRICE,
            DefaultGasProvider.GAS_LIMIT,
            to,
            encodedFn,
            value);
    if (send.hasError()) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "RPC error: " + send.getError().getMessage());
    }

    String txHash = send.getTransactionHash();
    TransactionReceipt receipt = waitForReceipt(txHash);
    if (!"0x1".equals(receipt.getStatus())) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST,
          "Transaction reverted on-chain: hash=" + txHash + " status=" + receipt.getStatus());
    }

    return new TxReceiptDto(
        txHash,
        receipt.getBlockNumber(),
        "success",
        receipt.getGasUsed(),
        receipt.getTo(),
        credentials.getAddress(),
        catalog.decode(receipt.getLogs()));
  }

  private TransactionReceipt waitForReceipt(String txHash) throws Exception {
    for (int i = 0; i < RECEIPT_POLL_ATTEMPTS; i++) {
      var resp = web3j.ethGetTransactionReceipt(txHash).send();
      if (resp.getTransactionReceipt().isPresent()) {
        return resp.getTransactionReceipt().get();
      }
      Thread.sleep(RECEIPT_POLL_DELAY_MS);
    }
    throw new TransactionException("Receipt not available after polling: " + txHash);
  }

  /**
   * Best-effort decode of a Solidity revert. Hardhat returns either a string reason or hex data
   * starting with a 4-byte custom-error selector; {@link RevertDecoder} resolves selectors back
   * to their signature so the UI shows "AccessControlUnauthorizedAccount" instead of "0xe2517d3f...".
   */
  static String decodeRevert(String revertReason) {
    if (revertReason == null || revertReason.isBlank()) {
      return "Transaction reverted (no reason)";
    }
    String resolved = RevertDecoder.decode(revertReason);
    if (resolved != null) {
      return "Transaction reverted: " + resolved + " (raw=" + revertReason + ")";
    }
    return "Transaction reverted: " + revertReason;
  }
}
