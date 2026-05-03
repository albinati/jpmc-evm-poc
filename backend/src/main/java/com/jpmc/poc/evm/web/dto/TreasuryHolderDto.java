package com.jpmc.poc.evm.web.dto;

public record TreasuryHolderDto(
    String address, String balance, boolean blacklisted, String frozenUntil) {}
