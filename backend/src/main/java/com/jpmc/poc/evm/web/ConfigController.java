package com.jpmc.poc.evm.web;

import com.jpmc.poc.evm.config.ContractAddresses;
import com.jpmc.poc.evm.config.DeploymentAddresses.DeploymentFile;
import com.jpmc.poc.evm.config.PocProperties;
import com.jpmc.poc.evm.key.SignerCredentialsProvider;
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

  public ConfigController(
      PocProperties properties,
      ContractAddresses addresses,
      DeploymentFile deploymentFile,
      SignerCredentialsProvider signer) {
    this.properties = properties;
    this.addresses = addresses;
    this.deploymentFile = deploymentFile;
    this.signer = signer;
  }

  @GetMapping("/config")
  public ApiConfigDto config() {
    boolean allConfigured =
        signer.banker().isPresent()
            && signer.compliance().isPresent()
            && signer.liquidationAgent().isPresent();
    return new ApiConfigDto(
        deploymentFile.chainId(),
        properties.rpcUrl(),
        addresses.facility(),
        addresses.treasury(),
        addresses.title(),
        addresses.trade(),
        signer.banker().map(c -> c.getAddress()).orElse(null),
        signer.compliance().map(c -> c.getAddress()).orElse(null),
        signer.liquidationAgent().map(c -> c.getAddress()).orElse(null),
        allConfigured,
        properties.nextResetAt());
  }
}
