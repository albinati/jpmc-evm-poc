package com.jpmc.poc.evm.web;

import com.jpmc.poc.evm.service.BlockchainReadService;
import com.jpmc.poc.evm.service.FacilityWorkflowService;
import com.jpmc.poc.evm.web.dto.FacilityDto;
import com.jpmc.poc.evm.web.dto.FinalizeLiquidationRequest;
import com.jpmc.poc.evm.web.dto.TopUpRequest;
import com.jpmc.poc.evm.web.dto.TxReceiptDto;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
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
  public TxReceiptDto hold(@PathVariable long facilityId) throws Exception {
    return workflowService.applyComplianceHold(facilityId);
  }

  @PostMapping("/{facilityId}/compliance-release")
  public TxReceiptDto release(@PathVariable long facilityId) throws Exception {
    return workflowService.releaseComplianceHold(facilityId);
  }

  @PostMapping("/{facilityId}/liquidation/commence")
  public TxReceiptDto commenceLiquidation(@PathVariable long facilityId) throws Exception {
    return workflowService.commenceLiquidation(facilityId);
  }

  @PostMapping("/{facilityId}/liquidation/finalize")
  public TxReceiptDto finalizeLiquidation(
      @PathVariable long facilityId, @Valid @RequestBody FinalizeLiquidationRequest body)
      throws Exception {
    return workflowService.finalizeLiquidation(facilityId, body.recoveryAddress());
  }

  @PostMapping("/{facilityId}/topup")
  public TxReceiptDto topUp(@PathVariable long facilityId, @Valid @RequestBody TopUpRequest body)
      throws Exception {
    return workflowService.topUpCash(facilityId, body.amount());
  }
}
