package com.jpmc.poc.evm.key;

import java.util.Optional;
import org.web3j.crypto.Credentials;

public interface SignerCredentialsProvider {

  Optional<Credentials> credentials();
}
