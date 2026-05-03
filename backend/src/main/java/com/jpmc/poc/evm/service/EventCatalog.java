package com.jpmc.poc.evm.service;

import com.jpmc.poc.evm.config.ContractAddresses;
import com.jpmc.poc.evm.web.dto.EventLogDto;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;
import org.web3j.abi.EventEncoder;
import org.web3j.abi.FunctionReturnDecoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.Bool;
import org.web3j.abi.datatypes.Event;
import org.web3j.abi.datatypes.Type;
import org.web3j.abi.datatypes.Utf8String;
import org.web3j.abi.datatypes.generated.Bytes32;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.protocol.core.methods.response.Log;

/**
 * Registers every event the four POC contracts can emit (custom + the ERC standard ones we
 * care about) and decodes raw {@link Log}s into {@link EventLogDto}s for the UI.
 */
@Component
public class EventCatalog {

  private record Descriptor(
      String contract, Event event, List<String> indexedNames, List<String> nonIndexedNames) {}

  private final Map<String, Descriptor> byTopic0 = new HashMap<>();
  private final Map<String, String> contractByAddress = new HashMap<>();

  public EventCatalog(ContractAddresses addresses) {
    registerTreasury();
    registerTitle();
    registerTrade();
    registerFacility();

    contractByAddress.put(addresses.treasury().toLowerCase(Locale.ROOT), "CorporateTreasury");
    contractByAddress.put(addresses.title().toLowerCase(Locale.ROOT), "TitleTokenization");
    contractByAddress.put(addresses.trade().toLowerCase(Locale.ROOT), "TradeFinance");
    contractByAddress.put(addresses.facility().toLowerCase(Locale.ROOT), "CollateralizedFacility");
  }

  public List<EventLogDto> decode(List<Log> logs) {
    List<EventLogDto> out = new ArrayList<>(logs.size());
    for (Log log : logs) {
      out.add(decodeOne(log));
    }
    return out;
  }

  private EventLogDto decodeOne(Log log) {
    List<String> topics = log.getTopics();
    String topic0 = topics.isEmpty() ? null : topics.get(0).toLowerCase(Locale.ROOT);
    String emittingAddress = log.getAddress();
    String contract =
        contractByAddress.getOrDefault(emittingAddress.toLowerCase(Locale.ROOT), "?");

    if (topic0 == null) {
      return EventLogDto.unknown(emittingAddress, "(no topic0)");
    }

    Descriptor desc = byTopic0.get(topic0);
    if (desc == null) {
      return EventLogDto.unknown(emittingAddress, topic0);
    }

    Map<String, String> args = new LinkedHashMap<>();

    List<TypeReference<Type>> indexedRefs = desc.event.getIndexedParameters();
    for (int i = 0; i < indexedRefs.size() && i + 1 < topics.size(); i++) {
      Type<?> decoded = FunctionReturnDecoder.decodeIndexedValue(topics.get(i + 1), indexedRefs.get(i));
      args.put(desc.indexedNames.get(i), stringify(decoded));
    }

    List<TypeReference<Type>> nonIndexedRefs = desc.event.getNonIndexedParameters();
    if (!nonIndexedRefs.isEmpty()) {
      List<Type> values = FunctionReturnDecoder.decode(log.getData(), nonIndexedRefs);
      for (int i = 0; i < values.size() && i < desc.nonIndexedNames.size(); i++) {
        args.put(desc.nonIndexedNames.get(i), stringify(values.get(i)));
      }
    }

    return new EventLogDto(
        desc.event.getName(), desc.contract.equals("?") ? contract : desc.contract, emittingAddress, args);
  }

  private static String stringify(Type<?> t) {
    Object v = t.getValue();
    if (v instanceof byte[] bytes) {
      StringBuilder hex = new StringBuilder("0x");
      for (byte b : bytes) hex.append(String.format("%02x", b));
      return hex.toString();
    }
    if (v instanceof BigInteger bi) {
      return bi.toString();
    }
    return String.valueOf(v);
  }

  private void register(
      String contract, Event event, List<String> indexedNames, List<String> nonIndexedNames) {
    String topic0 = EventEncoder.encode(event).toLowerCase(Locale.ROOT);
    byTopic0.put(topic0, new Descriptor(contract, event, indexedNames, nonIndexedNames));
  }

  private void registerTreasury() {
    register(
        "CorporateTreasury",
        new Event("Transfer", typeRefs(Address.class, true, Address.class, true, Uint256.class, false)),
        List.of("from", "to"),
        List.of("value"));
    register(
        "CorporateTreasury",
        new Event("Approval", typeRefs(Address.class, true, Address.class, true, Uint256.class, false)),
        List.of("owner", "spender"),
        List.of("value"));
    register(
        "CorporateTreasury",
        new Event("Paused", typeRefs(Address.class, false)),
        List.of(),
        List.of("account"));
    register(
        "CorporateTreasury",
        new Event("Unpaused", typeRefs(Address.class, false)),
        List.of(),
        List.of("account"));
    register(
        "CorporateTreasury",
        new Event("Blacklisted", typeRefs(Address.class, true, Bool.class, true)),
        List.of("account", "status"),
        List.of());
    register(
        "CorporateTreasury",
        new Event("FundsFrozen", typeRefs(Address.class, true, Uint256.class, true)),
        List.of("account", "until"),
        List.of());
    register(
        "CorporateTreasury",
        new Event("FundsReleased", typeRefs(Address.class, true)),
        List.of("account"),
        List.of());
    register(
        "CorporateTreasury",
        new Event(
            "ComplianceForceTransfer",
            typeRefs(
                Address.class, true,
                Address.class, true,
                Uint256.class, false,
                Bytes32.class, false,
                Address.class, true)),
        List.of("from", "to", "officer"),
        List.of("amount", "reason"));
    register(
        "CorporateTreasury",
        new Event(
            "ComplianceHold",
            typeRefs(Address.class, true, Address.class, true, Uint256.class, false)),
        List.of("from", "to"),
        List.of("value"));
  }

  private void registerTitle() {
    register(
        "TitleTokenization",
        new Event(
            "Transfer", typeRefs(Address.class, true, Address.class, true, Uint256.class, true)),
        List.of("from", "to", "tokenId"),
        List.of());
    register(
        "TitleTokenization",
        new Event(
            "TitleMinted",
            typeRefs(Uint256.class, false, Address.class, true, Utf8String.class, false)),
        List.of("propertyAddress"),
        List.of("tokenId", "jurisdiction"));
    register(
        "TitleTokenization",
        new Event(
            "TitleTransferred",
            typeRefs(Uint256.class, false, Address.class, true, Address.class, true)),
        List.of("from", "to"),
        List.of("tokenId"));
    register(
        "TitleTokenization",
        new Event("TitleEncumbered", typeRefs(Uint256.class, false, Bool.class, true)),
        List.of("isEncumbered"),
        List.of("tokenId"));
    register(
        "TitleTokenization",
        new Event("BuyerQualified", typeRefs(Address.class, true, Bool.class, true)),
        List.of("account", "qualified"),
        List.of());
    register(
        "TitleTokenization",
        new Event(
            "TokenURIUpdated",
            typeRefs(Uint256.class, true, Utf8String.class, false, Address.class, true)),
        List.of("tokenId", "updatedBy"),
        List.of("newURI"));
  }

  private void registerTrade() {
    register(
        "TradeFinance",
        new Event(
            "InvoiceCreated",
            typeRefs(
                Uint256.class, true,
                Address.class, true,
                Address.class, true,
                Uint256.class, false,
                Uint256.class, false,
                Utf8String.class, false)),
        List.of("invoiceId", "receivableParty", "payableParty"),
        List.of("amount", "dueDate", "invoiceRef"));
    register(
        "TradeFinance",
        new Event("InvoiceSettled", typeRefs(Uint256.class, true, Address.class, true)),
        List.of("invoiceId", "settler"),
        List.of());
    register(
        "TradeFinance",
        new Event(
            "InvoicePartiallySettled",
            typeRefs(Uint256.class, true, Uint256.class, false, Address.class, true)),
        List.of("invoiceId", "settler"),
        List.of("partialAmount"));
    register(
        "TradeFinance",
        new Event(
            "InvoiceFactored",
            typeRefs(Uint256.class, true, Address.class, true, Uint256.class, false)),
        List.of("invoiceId", "factor"),
        List.of("amount"));
    register(
        "TradeFinance",
        new Event(
            "InvoiceDueDateExtended",
            typeRefs(
                Uint256.class, true,
                Uint256.class, false,
                Uint256.class, false,
                Address.class, true)),
        List.of("invoiceId", "by"),
        List.of("oldDueDate", "newDueDate"));
    register(
        "TradeFinance",
        new Event("Paused", typeRefs(Address.class, false)),
        List.of(),
        List.of("account"));
    register(
        "TradeFinance",
        new Event("Unpaused", typeRefs(Address.class, false)),
        List.of(),
        List.of("account"));
  }

  private void registerFacility() {
    register(
        "CollateralizedFacility",
        new Event(
            "FacilityCreated",
            typeRefs(Uint256.class, true, Address.class, true, Uint256.class, false)),
        List.of("facilityId", "borrower"),
        List.of("tradeFinanceRefId"));
    register(
        "CollateralizedFacility",
        new Event(
            "FacilityFunded",
            typeRefs(
                Uint256.class, true,
                Address.class, true,
                Uint256.class, false,
                Uint256.class, false)),
        List.of("facilityId", "borrower"),
        List.of("cashAmount", "titleTokenId"));
    register(
        "CollateralizedFacility",
        new Event(
            "ComplianceHoldApplied", typeRefs(Uint256.class, true, Address.class, true)),
        List.of("facilityId", "actor"),
        List.of());
    register(
        "CollateralizedFacility",
        new Event(
            "ComplianceHoldReleased", typeRefs(Uint256.class, true, Address.class, true)),
        List.of("facilityId", "actor"),
        List.of());
    register(
        "CollateralizedFacility",
        new Event(
            "LiquidationCommenced", typeRefs(Uint256.class, true, Address.class, true)),
        List.of("facilityId", "actor"),
        List.of());
    register(
        "CollateralizedFacility",
        new Event(
            "LiquidationFinalized",
            typeRefs(
                Uint256.class, true,
                Address.class, true,
                Uint256.class, false,
                Uint256.class, false)),
        List.of("facilityId", "recovery"),
        List.of("cashTransferred", "titleTokenIdTransferred"));
    register(
        "CollateralizedFacility",
        new Event(
            "FacilityReleasedNormally", typeRefs(Uint256.class, true, Address.class, true)),
        List.of("facilityId", "borrower"),
        List.of());
    register(
        "CollateralizedFacility",
        new Event(
            "CashToppedUp",
            typeRefs(
                Uint256.class, true,
                Address.class, true,
                Uint256.class, false,
                Uint256.class, false)),
        List.of("facilityId", "borrower"),
        List.of("amount", "newLockedCash"));
  }

  /**
   * Build a List&lt;TypeReference&lt;?&gt;&gt; from alternating (class, indexed) pairs.
   * Web3j's {@link Event} expects parameters in declaration order, marked indexed where appropriate.
   */
  private static List<TypeReference<?>> typeRefs(Object... parts) {
    if (parts.length % 2 != 0) {
      throw new IllegalArgumentException("typeRefs requires (Class, boolean) pairs");
    }
    List<TypeReference<?>> out = new ArrayList<>(parts.length / 2);
    for (int i = 0; i < parts.length; i += 2) {
      @SuppressWarnings("unchecked")
      Class<? extends Type> klass = (Class<? extends Type>) parts[i];
      boolean indexed = (Boolean) parts[i + 1];
      out.add(TypeReference.create(klass, indexed));
    }
    return out;
  }
}
