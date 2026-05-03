package com.jpmc.poc.evm.web;

import com.jpmc.poc.evm.service.BlockchainReadService;
import com.jpmc.poc.evm.service.TradeFinanceWorkflowService;
import com.jpmc.poc.evm.web.dto.CreateInvoiceRequest;
import com.jpmc.poc.evm.web.dto.ExtendDueDateRequest;
import com.jpmc.poc.evm.web.dto.FactorInvoiceRequest;
import com.jpmc.poc.evm.web.dto.SettleInvoiceRequest;
import com.jpmc.poc.evm.web.dto.TxReceiptDto;
import jakarta.validation.Valid;
import java.math.BigInteger;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/invoices")
public class TradeFinanceController {

  private final TradeFinanceWorkflowService workflow;
  private final BlockchainReadService reads;

  public TradeFinanceController(TradeFinanceWorkflowService workflow, BlockchainReadService reads) {
    this.workflow = workflow;
    this.reads = reads;
  }

  @GetMapping("/{invoiceId}")
  public Object get(@PathVariable BigInteger invoiceId) throws Exception {
    return reads.getInvoice(invoiceId);
  }

  @PostMapping
  public TxReceiptDto create(@Valid @RequestBody CreateInvoiceRequest body) throws Exception {
    return workflow.createInvoice(
        body.receivableParty(),
        body.payableParty(),
        body.amount(),
        body.dueDate(),
        body.invoiceRef(),
        body.initialSupply());
  }

  @PostMapping("/{invoiceId}/settle")
  public TxReceiptDto settle(
      @PathVariable BigInteger invoiceId, @Valid @RequestBody SettleInvoiceRequest body) throws Exception {
    return workflow.settleInvoice(invoiceId, body.amount());
  }

  @PostMapping("/{invoiceId}/factor")
  public TxReceiptDto factor(
      @PathVariable BigInteger invoiceId, @Valid @RequestBody FactorInvoiceRequest body) throws Exception {
    return workflow.factorInvoice(invoiceId, body.factor(), body.amount());
  }

  @PostMapping("/{invoiceId}/extend")
  public TxReceiptDto extend(
      @PathVariable BigInteger invoiceId, @Valid @RequestBody ExtendDueDateRequest body) throws Exception {
    return workflow.extendDueDate(invoiceId, body.newDueDate());
  }

  @PostMapping("/pause")
  public TxReceiptDto pause() throws Exception {
    return workflow.pause();
  }

  @PostMapping("/unpause")
  public TxReceiptDto unpause() throws Exception {
    return workflow.unpause();
  }
}
