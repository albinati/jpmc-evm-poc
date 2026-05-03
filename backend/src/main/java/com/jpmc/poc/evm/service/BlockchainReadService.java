package com.jpmc.poc.evm.service;

import com.jpmc.poc.evm.config.ContractAddresses;
import com.jpmc.poc.evm.web.dto.FacilityDto;
import com.jpmc.poc.evm.web.dto.InvoiceDto;
import com.jpmc.poc.evm.web.dto.TitleDto;
import com.jpmc.poc.evm.web.dto.TreasuryHolderDto;
import com.jpmc.poc.evm.web.dto.TreasuryStatusDto;
import java.math.BigInteger;
import java.util.List;
import org.springframework.stereotype.Service;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.FunctionReturnDecoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.Bool;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.Type;
import org.web3j.abi.datatypes.Utf8String;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.abi.datatypes.generated.Uint8;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.core.methods.response.EthCall;

@Service
public class BlockchainReadService {

  private final Web3j web3j;
  private final ContractAddresses addresses;

  public BlockchainReadService(Web3j web3j, ContractAddresses addresses) {
    this.web3j = web3j;
    this.addresses = addresses;
  }

  // -------------------- Facility --------------------

  public FacilityDto getFacility(long facilityId) throws Exception {
    Function function =
        new Function(
            "getFacilityParts",
            List.of(new Uint256(BigInteger.valueOf(facilityId))),
            List.of(
                new TypeReference<Address>() {},
                new TypeReference<Uint8>() {},
                new TypeReference<Uint256>() {},
                new TypeReference<Uint256>() {},
                new TypeReference<Uint256>() {}));

    String value = ethCall(addresses.facility(), function);
    if (value == null || "0x".equals(value)) {
      return new FacilityDto(facilityId, null, "UNKNOWN", "0", "0", "0", "0");
    }

    List<Type> parts = FunctionReturnDecoder.decode(value, function.getOutputParameters());
    if (parts.size() < 5) {
      throw new IllegalStateException("Could not decode getFacilityParts");
    }

    String borrower = ((Address) parts.get(0)).getValue();
    int state = ((Uint8) parts.get(1)).getValue().intValue();
    BigInteger lockedCash = ((Uint256) parts.get(2)).getValue();
    BigInteger titleId = ((Uint256) parts.get(3)).getValue();
    BigInteger tradeRef = ((Uint256) parts.get(4)).getValue();

    return new FacilityDto(
        facilityId,
        borrower,
        stateName(state),
        lockedCash.toString(),
        titleId.toString(),
        tradeRef.toString(),
        String.valueOf(state));
  }

  // -------------------- Treasury --------------------

  public String getTreasuryTotalSupply() throws Exception {
    Function function = new Function("totalSupply", List.of(), List.of(new TypeReference<Uint256>() {}));
    String value = ethCall(addresses.treasury(), function);
    return ((Uint256) FunctionReturnDecoder.decode(value, function.getOutputParameters()).get(0))
        .getValue()
        .toString();
  }

  public TreasuryStatusDto getTreasuryStatus() throws Exception {
    Function nameFn = new Function("name", List.of(), List.of(new TypeReference<Utf8String>() {}));
    Function symFn = new Function("symbol", List.of(), List.of(new TypeReference<Utf8String>() {}));
    Function decFn = new Function("decimals", List.of(), List.of(new TypeReference<Uint8>() {}));
    Function pausedFn = new Function("paused", List.of(), List.of(new TypeReference<Bool>() {}));
    Function supplyFn = new Function("totalSupply", List.of(), List.of(new TypeReference<Uint256>() {}));

    String name = ((Utf8String) decode(addresses.treasury(), nameFn).get(0)).getValue();
    String sym = ((Utf8String) decode(addresses.treasury(), symFn).get(0)).getValue();
    int dec = ((Uint8) decode(addresses.treasury(), decFn).get(0)).getValue().intValue();
    boolean paused = ((Bool) decode(addresses.treasury(), pausedFn).get(0)).getValue();
    BigInteger supply = ((Uint256) decode(addresses.treasury(), supplyFn).get(0)).getValue();
    return new TreasuryStatusDto(name, sym, dec, paused, supply.toString());
  }

  public TreasuryHolderDto getTreasuryHolder(String address) throws Exception {
    Function balFn =
        new Function(
            "balanceOf", List.of(new Address(address)), List.of(new TypeReference<Uint256>() {}));
    Function bl =
        new Function(
            "isBlacklisted", List.of(new Address(address)), List.of(new TypeReference<Bool>() {}));
    Function fz =
        new Function(
            "frozenUntil", List.of(new Address(address)), List.of(new TypeReference<Uint256>() {}));

    BigInteger balance = ((Uint256) decode(addresses.treasury(), balFn).get(0)).getValue();
    boolean blacklisted = ((Bool) decode(addresses.treasury(), bl).get(0)).getValue();
    BigInteger frozen = ((Uint256) decode(addresses.treasury(), fz).get(0)).getValue();
    return new TreasuryHolderDto(address, balance.toString(), blacklisted, frozen.toString());
  }

  // -------------------- Title --------------------

  public TitleDto getTitleDetail(BigInteger tokenId) throws Exception {
    Function fn =
        new Function(
            "getTitleDetailParts",
            List.of(new Uint256(tokenId)),
            List.of(
                new TypeReference<Address>() {},
                new TypeReference<Utf8String>() {},
                new TypeReference<Address>() {},
                new TypeReference<Uint256>() {},
                new TypeReference<Uint256>() {},
                new TypeReference<Bool>() {},
                new TypeReference<Utf8String>() {}));

    List<Type> parts = decode(addresses.title(), fn);
    return new TitleDto(
        tokenId.toString(),
        ((Address) parts.get(0)).getValue(),
        ((Utf8String) parts.get(1)).getValue(),
        ((Address) parts.get(2)).getValue(),
        ((Uint256) parts.get(3)).getValue().toString(),
        ((Uint256) parts.get(4)).getValue().toString(),
        ((Bool) parts.get(5)).getValue(),
        ((Utf8String) parts.get(6)).getValue());
  }

  // -------------------- Trade Finance --------------------

  public InvoiceDto getInvoice(BigInteger invoiceId) throws Exception {
    Function fn =
        new Function(
            "getInvoiceParts",
            List.of(new Uint256(invoiceId)),
            List.of(
                new TypeReference<Address>() {},
                new TypeReference<Address>() {},
                new TypeReference<Uint256>() {},
                new TypeReference<Uint256>() {},
                new TypeReference<Bool>() {},
                new TypeReference<Uint256>() {},
                new TypeReference<Utf8String>() {}));

    List<Type> parts = decode(addresses.trade(), fn);
    return new InvoiceDto(
        invoiceId.toString(),
        ((Address) parts.get(0)).getValue(),
        ((Address) parts.get(1)).getValue(),
        ((Uint256) parts.get(2)).getValue().toString(),
        ((Uint256) parts.get(3)).getValue().toString(),
        ((Bool) parts.get(4)).getValue(),
        ((Uint256) parts.get(5)).getValue().toString(),
        ((Utf8String) parts.get(6)).getValue());
  }

  // -------------------- Helpers --------------------

  private String ethCall(String contract, Function function) throws Exception {
    String encoded = FunctionEncoder.encode(function);
    EthCall response =
        web3j
            .ethCall(
                Transaction.createEthCallTransaction(null, contract, encoded),
                DefaultBlockParameterName.LATEST)
            .send();
    return response.getValue();
  }

  private List<Type> decode(String contract, Function function) throws Exception {
    String value = ethCall(contract, function);
    return FunctionReturnDecoder.decode(value, function.getOutputParameters());
  }

  private static String stateName(int s) {
    return switch (s) {
      case 0 -> "Draft";
      case 1 -> "Active";
      case 2 -> "ComplianceHold";
      case 3 -> "Liquidation";
      case 4 -> "Closed";
      default -> "Unknown(" + s + ")";
    };
  }
}
