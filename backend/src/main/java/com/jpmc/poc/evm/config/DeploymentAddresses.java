package com.jpmc.poc.evm.config;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DeploymentAddresses {

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record DeploymentFile(long chainId, String deployer, Map<String, String> contracts) {}

  @Bean
  DeploymentFile deploymentFile(PocProperties props) throws IOException {
    String loc = props.deploymentsFile();
    ObjectMapper mapper = new ObjectMapper();
    if (loc.startsWith("classpath:")) {
      String path = loc.substring("classpath:".length()).replaceFirst("^/", "");
      ClassLoader cl = Thread.currentThread().getContextClassLoader();
      try (InputStream in = cl.getResourceAsStream(path)) {
        if (in == null) {
          throw new IllegalStateException("Classpath deployments not found: " + path);
        }
        return mapper.readValue(in, DeploymentFile.class);
      }
    }
    Path p = Path.of(loc);
    if (!Files.isRegularFile(p)) {
      throw new IllegalStateException("Deployments file not found: " + p.toAbsolutePath());
    }
    return mapper.readValue(p.toFile(), DeploymentFile.class);
  }

  @Bean
  ContractAddresses contractAddresses(DeploymentFile file) {
    return new ContractAddresses(
        file.contracts().get("CollateralizedFacility"),
        file.contracts().get("CorporateTreasury"));
  }
}
