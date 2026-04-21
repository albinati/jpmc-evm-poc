package com.jpmc.poc.evm.web;

import com.jpmc.poc.evm.service.BlockchainReadService;
import com.jpmc.poc.evm.service.FacilityWorkflowService;
import com.jpmc.poc.evm.web.dto.FacilityDto;
import com.jpmc.poc.evm.web.dto.FinalizeLiquidationRequest;
import jakarta.validation.Valid;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/facilities")
public class FacilityController {

  private final BlockchainReadService readService;
  private final FacilityWorkflowService workflowService;

  public FacilityController(BlockchainReadService readService, FacilityWorkflowService workflowService) {
    this.readService = readService;
    this.workflowService = workflowService;
  }

  @GetMapping("/{facilityId}")
  public FacilityDto get(@PathVariable long facilityId) throws Exception {
    return readService.getFacility(facilityId);
  }

  @PostMapping("/{facilityId}/compliance-hold")
  public Map<String, String> hold(
      @PathVariable long facilityId,
      @RequestHeader(value = "X-Correlation-Id", required = false) String correlationId)
      throws Exception {
    String tx =
        workflowService.applyComplianceHold(facilityId, correlationId != null ? correlationId : "n/a");
    return Map.of("transactionHash", tx);
  }

  @PostMapping("/{facilityId}/compliance-release")
  public Map<String, String> release(
      @PathVariable long facilityId,
      @RequestHeader(value = "X-Correlation-Id", required = false) String correlationId)
      throws Exception {
    String tx =
        workflowService.releaseComplianceHold(facilityId, correlationId != null ? correlationId : "n/a");
    return Map.of("transactionHash", tx);
  }

  @PostMapping("/{facilityId}/liquidation/commence")
  public Map<String, String> commenceLiquidation(
      @PathVariable long facilityId,
      @RequestHeader(value = "X-Correlation-Id", required = false) String correlationId)
      throws Exception {
    String tx =
        workflowService.commenceLiquidation(facilityId, correlationId != null ? correlationId : "n/a");
    return Map.of("transactionHash", tx);
  }

  @PostMapping("/{facilityId}/liquidation/finalize")
  public Map<String, String> finalize(
      @PathVariable long facilityId,
      @Valid @RequestBody FinalizeLiquidationRequest body,
      @RequestHeader(value = "X-Correlation-Id", required = false) String correlationId)
      throws Exception {
    String tx =
        workflowService.finalizeLiquidation(
            facilityId, body.recoveryAddress(), correlationId != null ? correlationId : "n/a");
    return Map.of("transactionHash", tx);
  }
}
