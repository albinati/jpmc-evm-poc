package com.jpmc.poc.evm.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.http.HttpService;

@Configuration
public class Web3jConfiguration {

  @Bean
  Web3j web3j(PocProperties properties) {
    return Web3j.build(new HttpService(properties.rpcUrl()));
  }
}
