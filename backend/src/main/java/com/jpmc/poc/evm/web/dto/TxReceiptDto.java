package com.jpmc.poc.evm.web.dto;

import java.math.BigInteger;
import java.util.List;

public record TxReceiptDto(
    String transactionHash,
    BigInteger blockNumber,
    String status,
    BigInteger gasUsed,
    String contractAddress,
    String from,
    List<EventLogDto> events) {}
