package com.jpmc.poc.evm.web.dto;

public record TitleDto(
    String tokenId,
    String owner,
    String tokenURI,
    String propertyAddress,
    String lastSalePrice,
    String lastSaleTimestamp,
    boolean isEncumbered,
    String jurisdiction) {}
