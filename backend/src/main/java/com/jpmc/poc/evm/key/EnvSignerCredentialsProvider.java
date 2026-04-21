package com.jpmc.poc.evm.key;

import com.jpmc.poc.evm.config.PocProperties;
import java.util.Optional;
import org.springframework.stereotype.Component;
import org.web3j.crypto.Credentials;

@Component
public class EnvSignerCredentialsProvider implements SignerCredentialsProvider {

  private final Optional<Credentials> credentials;

  public EnvSignerCredentialsProvider(PocProperties properties) {
    String key = properties.signerPrivateKey();
    if (key == null || key.isBlank()) {
      credentials = Optional.empty();
    } else {
      String hex = key.startsWith("0x") ? key.substring(2) : key;
      credentials = Optional.of(Credentials.create(hex));
    }
  }

  @Override
  public Optional<Credentials> credentials() {
    return credentials;
  }
}
