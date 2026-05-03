package com.jpmc.poc.evm.web.dto;

public record TreasuryStatusDto(String name, String symbol, int decimals, boolean paused, String totalSupply) {}
