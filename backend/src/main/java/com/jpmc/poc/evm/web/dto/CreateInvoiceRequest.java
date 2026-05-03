package com.jpmc.poc.evm.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigInteger;

public record CreateInvoiceRequest(
    @NotBlank String receivableParty,
    @NotBlank String payableParty,
    @NotNull @Positive BigInteger amount,
    @NotNull @Positive BigInteger dueDate,
    @NotBlank String invoiceRef,
    @NotNull @Positive BigInteger initialSupply) {}
