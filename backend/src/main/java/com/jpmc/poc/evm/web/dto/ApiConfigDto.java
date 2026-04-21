package com.jpmc.poc.evm.web.dto;

import com.jpmc.poc.evm.config.ContractAddresses;

public record ApiConfigDto(
    long chainId,
    String rpcUrl,
    String facilityContract,
    String treasuryContract,
    boolean workflowSignerConfigured
) {

  public static ApiConfigDto from(
      long chainId, String rpcUrl, ContractAddresses addresses, boolean signerOk) {
    return new ApiConfigDto(chainId, rpcUrl, addresses.facility(), addresses.treasury(), signerOk);
  }
}
