package com.jpmc.poc.evm.web.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateUriRequest(@NotBlank String uri) {}
