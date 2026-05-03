package com.jpmc.poc.evm.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigInteger;

public record FactorInvoiceRequest(@NotBlank String factor, @NotNull @Positive BigInteger amount) {}
