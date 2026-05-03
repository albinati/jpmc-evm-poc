package com.jpmc.poc.evm.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigInteger;

public record MintTitleRequest(
    @NotBlank String to,
    @NotNull @Positive BigInteger tokenId,
    @NotBlank String tokenURI,
    @NotBlank String propertyAddress,
    @NotNull BigInteger salePrice,
    @NotBlank String jurisdiction) {}
