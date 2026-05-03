package com.jpmc.poc.evm.web.dto;

import jakarta.validation.constraints.NotBlank;

public record QualifiedBuyerRequest(@NotBlank String address, boolean on) {}
