package com.jpmc.poc.evm.key;

import com.jpmc.poc.evm.config.PocProperties;
import java.util.Optional;
import org.springframework.stereotype.Component;
import org.web3j.crypto.Credentials;

@Component
public class EnvSignerCredentialsProvider implements SignerCredentialsProvider {

  // Hardhat well-known dev keys — public, used only when allowDevDefaults=true.
  // Account index matches scripts/deploy.js (banker=#1, compliance=#2, liquidation=#3).
  private static final String DEV_BANKER_KEY =
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
  private static final String DEV_COMPLIANCE_KEY =
      "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";
  private static final String DEV_LIQUIDATION_KEY =
      "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6";

  private final Optional<Credentials> banker;
  private final Optional<Credentials> compliance;
  private final Optional<Credentials> liquidationAgent;

  public EnvSignerCredentialsProvider(PocProperties properties) {
    String fallback = properties.signerPrivateKey();
    boolean dev = properties.allowDevDefaults();
    banker = resolve(properties.bankerPrivateKey(), fallback, dev ? DEV_BANKER_KEY : null);
    compliance = resolve(properties.compliancePrivateKey(), fallback, dev ? DEV_COMPLIANCE_KEY : null);
    liquidationAgent =
        resolve(properties.liquidationPrivateKey(), fallback, dev ? DEV_LIQUIDATION_KEY : null);
  }

  @Override
  public Optional<Credentials> banker() {
    return banker;
  }

  @Override
  public Optional<Credentials> compliance() {
    return compliance;
  }

  @Override
  public Optional<Credentials> liquidationAgent() {
    return liquidationAgent;
  }

  private static Optional<Credentials> resolve(String roleKey, String fallback, String devKey) {
    String chosen = pickFirstNonBlank(roleKey, fallback, devKey);
    if (chosen == null) {
      return Optional.empty();
    }
    String hex = chosen.startsWith("0x") ? chosen.substring(2) : chosen;
    return Optional.of(Credentials.create(hex));
  }

  private static String pickFirstNonBlank(String... values) {
    for (String v : values) {
      if (v != null && !v.isBlank()) {
        return v;
      }
    }
    return null;
  }
}
