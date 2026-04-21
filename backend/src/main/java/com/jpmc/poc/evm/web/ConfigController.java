package com.jpmc.poc.evm.web;

import com.jpmc.poc.evm.config.ContractAddresses;
import com.jpmc.poc.evm.config.DeploymentAddresses.DeploymentFile;
import com.jpmc.poc.evm.config.PocProperties;
import com.jpmc.poc.evm.key.SignerCredentialsProvider;
import com.jpmc.poc.evm.service.BlockchainReadService;
import com.jpmc.poc.evm.web.dto.ApiConfigDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class ConfigController {

  private final PocProperties properties;
  private final ContractAddresses addresses;
  private final DeploymentFile deploymentFile;
  private final SignerCredentialsProvider signer;
  private final BlockchainReadService readService;

  public ConfigController(
      PocProperties properties,
      ContractAddresses addresses,
      DeploymentFile deploymentFile,
      SignerCredentialsProvider signer,
      BlockchainReadService readService) {
    this.properties = properties;
    this.addresses = addresses;
    this.deploymentFile = deploymentFile;
    this.signer = signer;
    this.readService = readService;
  }

  @GetMapping("/config")
  public ApiConfigDto config() {
    return ApiConfigDto.from(
        deploymentFile.chainId(),
        properties.rpcUrl(),
        addresses,
        signer.credentials().isPresent());
  }

  @GetMapping("/treasury/total-supply")
  public String totalSupply() throws Exception {
    return readService.getTreasuryTotalSupply();
  }
}
