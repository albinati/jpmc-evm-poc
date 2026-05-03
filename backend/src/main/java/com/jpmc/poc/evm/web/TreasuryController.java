package com.jpmc.poc.evm.web;

import com.jpmc.poc.evm.service.BlockchainReadService;
import com.jpmc.poc.evm.service.TreasuryWorkflowService;
import com.jpmc.poc.evm.web.dto.BlacklistRequest;
import com.jpmc.poc.evm.web.dto.ForceTransferRequest;
import com.jpmc.poc.evm.web.dto.FreezeRequest;
import com.jpmc.poc.evm.web.dto.MintRequest;
import com.jpmc.poc.evm.web.dto.TxReceiptDto;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/treasury")
public class TreasuryController {

  private final TreasuryWorkflowService workflow;
  private final BlockchainReadService reads;

  public TreasuryController(TreasuryWorkflowService workflow, BlockchainReadService reads) {
    this.workflow = workflow;
    this.reads = reads;
  }

  @GetMapping("/total-supply")
  public String totalSupply() throws Exception {
    return reads.getTreasuryTotalSupply();
  }

  @GetMapping("/status")
  public Object status() throws Exception {
    return reads.getTreasuryStatus();
  }

  @GetMapping("/holders/{address}")
  public Object holder(@PathVariable String address) throws Exception {
    return reads.getTreasuryHolder(address);
  }

  @PostMapping("/mint")
  public TxReceiptDto mint(@Valid @RequestBody MintRequest body) throws Exception {
    return workflow.mint(body.to(), body.amount());
  }

  @PostMapping("/blacklist")
  public TxReceiptDto blacklist(@Valid @RequestBody BlacklistRequest body) throws Exception {
    return workflow.setBlacklist(body.address(), body.on());
  }

  @PostMapping("/freeze")
  public TxReceiptDto freeze(@Valid @RequestBody FreezeRequest body) throws Exception {
    return workflow.freeze(body.address(), body.durationSeconds());
  }

  @PostMapping("/release/{address}")
  public TxReceiptDto release(@PathVariable String address) throws Exception {
    return workflow.release(address);
  }

  @PostMapping("/pause")
  public TxReceiptDto pause() throws Exception {
    return workflow.pause();
  }

  @PostMapping("/unpause")
  public TxReceiptDto unpause() throws Exception {
    return workflow.unpause();
  }

  @PostMapping("/force-transfer")
  public TxReceiptDto forceTransfer(@Valid @RequestBody ForceTransferRequest body) throws Exception {
    return workflow.forceTransfer(body.from(), body.to(), body.amount(), body.reason());
  }
}
