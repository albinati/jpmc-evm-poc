package com.jpmc.poc.evm.web.dto;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Decoded view of a single on-chain log so the UI can describe what each ERC standard
 * actually emitted (Transfer, Paused, ComplianceForceTransfer, FacilityFunded, ...).
 */
public record EventLogDto(String name, String contract, String address, Map<String, String> args) {
  public static EventLogDto unknown(String address, String topic0) {
    Map<String, String> args = new LinkedHashMap<>();
    args.put("topic0", topic0);
    return new EventLogDto("(unknown)", "?", address, args);
  }
}
