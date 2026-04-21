package com.jpmc.poc.evm.service;

import com.jpmc.poc.evm.config.ContractAddresses;
import com.jpmc.poc.evm.config.DeploymentAddresses.DeploymentFile;
import com.jpmc.poc.evm.key.SignerCredentialsProvider;
import java.math.BigInteger;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.crypto.Credentials;
import org.web3j.protocol.Web3j;
import org.web3j.tx.RawTransactionManager;
import org.web3j.tx.gas.DefaultGasProvider;

@Service
public class FacilityWorkflowService {

  private final Web3j web3j;
  private final ContractAddresses addresses;
  private final SignerCredentialsProvider signer;
  private final long chainId;

  public FacilityWorkflowService(
      Web3j web3j,
      ContractAddresses addresses,
      SignerCredentialsProvider signer,
      DeploymentFile deploymentFile) {
    this.web3j = web3j;
    this.addresses = addresses;
    this.signer = signer;
    this.chainId = deploymentFile.chainId();
  }

  public String applyComplianceHold(long facilityId, String correlationId) throws Exception {
    Function fn =
        new Function(
            "applyComplianceHold",
            List.of(new Uint256(BigInteger.valueOf(facilityId))),
            List.of());
    return send(fn, correlationId);
  }

  public String releaseComplianceHold(long facilityId, String correlationId) throws Exception {
    Function fn =
        new Function(
            "releaseComplianceHold",
            List.of(new Uint256(BigInteger.valueOf(facilityId))),
            List.of());
    return send(fn, correlationId);
  }

  public String commenceLiquidation(long facilityId, String correlationId) throws Exception {
    Function fn =
        new Function(
            "commenceLiquidation",
            List.of(new Uint256(BigInteger.valueOf(facilityId))),
            List.of());
    return send(fn, correlationId);
  }

  public String finalizeLiquidation(long facilityId, String recoveryAddress, String correlationId)
      throws Exception {
    Function fn =
        new Function(
            "finalizeLiquidation",
            List.of(
                new Uint256(BigInteger.valueOf(facilityId)),
                new org.web3j.abi.datatypes.Address(recoveryAddress)),
            List.of());
    return send(fn, correlationId);
  }

  private String send(Function function, String correlationId) throws Exception {
    Credentials credentials =
        signer
            .credentials()
            .orElseThrow(
                () ->
                    new ResponseStatusException(
                        HttpStatus.SERVICE_UNAVAILABLE,
                        "Signer not configured (set POC_SIGNER_PRIVATE_KEY for workflow actions). correlationId="
                            + correlationId));

    RawTransactionManager txManager = new RawTransactionManager(web3j, credentials, chainId);
    String data = FunctionEncoder.encode(function);
    var response =
        txManager.sendTransaction(
            DefaultGasProvider.GAS_PRICE,
            DefaultGasProvider.GAS_LIMIT,
            addresses.facility(),
            data,
            BigInteger.ZERO);
    if (response.hasError()) {
      throw new IllegalStateException(response.getError().getMessage());
    }
    return response.getResult();
  }
}
