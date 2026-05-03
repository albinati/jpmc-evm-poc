package com.jpmc.poc.evm.key;

import java.util.Optional;
import org.web3j.crypto.Credentials;

/**
 * Provides ECDSA credentials for the three demo roles. The POC enforces segregation
 * of duties on-chain via AccessControl roles, so the orchestration API holds three
 * distinct private keys server-side and routes each workflow to the correct one.
 */
public interface SignerCredentialsProvider {

  Optional<Credentials> banker();

  Optional<Credentials> compliance();

  Optional<Credentials> liquidationAgent();

  /** Backwards-compatible single-credential view; returns the banker key. */
  default Optional<Credentials> credentials() {
    return banker();
  }
}
