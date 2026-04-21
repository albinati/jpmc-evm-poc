package com.jpmc.poc.evm.web.dto;

public record FacilityDto(
    long facilityId,
    String borrower,
    String state,
    String lockedCashWei,
    String titleTokenId,
    String tradeFinanceRefId,
    String stateCode
) {}
