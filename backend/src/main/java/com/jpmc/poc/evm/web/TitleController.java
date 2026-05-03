package com.jpmc.poc.evm.web;

import com.jpmc.poc.evm.service.BlockchainReadService;
import com.jpmc.poc.evm.service.TitleWorkflowService;
import com.jpmc.poc.evm.web.dto.EncumbranceRequest;
import com.jpmc.poc.evm.web.dto.MintTitleRequest;
import com.jpmc.poc.evm.web.dto.QualifiedBuyerRequest;
import com.jpmc.poc.evm.web.dto.TransferTitleRequest;
import com.jpmc.poc.evm.web.dto.TxReceiptDto;
import com.jpmc.poc.evm.web.dto.UpdateUriRequest;
import jakarta.validation.Valid;
import java.math.BigInteger;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/titles")
public class TitleController {

  private final TitleWorkflowService workflow;
  private final BlockchainReadService reads;

  public TitleController(TitleWorkflowService workflow, BlockchainReadService reads) {
    this.workflow = workflow;
    this.reads = reads;
  }

  @GetMapping("/{tokenId}")
  public Object get(@PathVariable BigInteger tokenId) throws Exception {
    return reads.getTitleDetail(tokenId);
  }

  @PostMapping("/mint")
  public TxReceiptDto mint(@Valid @RequestBody MintTitleRequest body) throws Exception {
    return workflow.mintTitle(
        body.to(), body.tokenId(), body.tokenURI(), body.propertyAddress(), body.salePrice(), body.jurisdiction());
  }

  @PostMapping("/{tokenId}/encumbrance")
  public TxReceiptDto encumbrance(
      @PathVariable BigInteger tokenId, @Valid @RequestBody EncumbranceRequest body) throws Exception {
    return workflow.setEncumbrance(tokenId, body.on());
  }

  @PostMapping("/{tokenId}/uri")
  public TxReceiptDto updateUri(
      @PathVariable BigInteger tokenId, @Valid @RequestBody UpdateUriRequest body) throws Exception {
    return workflow.updateTokenURI(tokenId, body.uri());
  }

  @PostMapping("/{tokenId}/transfer")
  public TxReceiptDto transfer(
      @PathVariable BigInteger tokenId, @Valid @RequestBody TransferTitleRequest body) throws Exception {
    return workflow.transferTitle(body.from(), body.to(), tokenId);
  }

  @PostMapping("/qualified-buyers")
  public TxReceiptDto qualifiedBuyer(@Valid @RequestBody QualifiedBuyerRequest body) throws Exception {
    return workflow.setQualifiedBuyer(body.address(), body.on());
  }
}
