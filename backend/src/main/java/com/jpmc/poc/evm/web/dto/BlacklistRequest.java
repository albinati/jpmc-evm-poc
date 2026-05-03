package com.jpmc.poc.evm.web.dto;

import jakarta.validation.constraints.NotBlank;

public record BlacklistRequest(@NotBlank String address, boolean on) {}
