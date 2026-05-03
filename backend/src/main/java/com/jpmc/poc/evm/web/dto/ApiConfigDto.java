package com.jpmc.poc.evm.web.dto;

public record ApiConfigDto(
    long chainId,
    String rpcUrl,
    String facilityContract,
    String treasuryContract,
    String titleContract,
    String tradeContract,
    String bankerAddress,
    String complianceAddress,
    String liquidationAgentAddress,
    boolean workflowSignerConfigured,
    Long nextResetAt) {}
