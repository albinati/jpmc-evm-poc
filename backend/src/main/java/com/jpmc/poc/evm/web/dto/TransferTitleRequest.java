package com.jpmc.poc.evm.web.dto;

import jakarta.validation.constraints.NotBlank;

public record TransferTitleRequest(@NotBlank String from, @NotBlank String to) {}
