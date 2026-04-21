package com.jpmc.poc.evm;

import com.jpmc.poc.evm.config.PocProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(PocProperties.class)
public class EvmOrchestrationApplication {

  public static void main(String[] args) {
    SpringApplication.run(EvmOrchestrationApplication.class, args);
  }
}
