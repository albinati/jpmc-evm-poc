package com.jpmc.poc.evm.web.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigInteger;

public record SettleInvoiceRequest(@NotNull @Positive BigInteger amount) {}
