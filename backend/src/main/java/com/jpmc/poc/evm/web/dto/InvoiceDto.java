package com.jpmc.poc.evm.web.dto;

public record InvoiceDto(
    String invoiceId,
    String receivableParty,
    String payableParty,
    String amount,
    String dueDate,
    boolean settled,
    String currentSupply,
    String invoiceReference) {}
