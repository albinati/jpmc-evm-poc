package com.jpmc.poc.evm.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "poc")
public record PocProperties(
    String rpcUrl,
    long chainId,
    String deploymentsFile,
    String signerPrivateKey,
    String bankerPrivateKey,
    String compliancePrivateKey,
    String liquidationPrivateKey,
    boolean allowDevDefaults,
    Long nextResetAt
) {}
