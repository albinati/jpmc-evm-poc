package com.jpmc.poc.evm.service;

import com.jpmc.poc.evm.config.ContractAddresses;
import com.jpmc.poc.evm.web.dto.FacilityDto;
import java.math.BigInteger;
import java.util.List;
import org.springframework.stereotype.Service;
import org.web3j.abi.FunctionEncoder;
import org.web3j.abi.FunctionReturnDecoder;
import org.web3j.abi.TypeReference;
import org.web3j.abi.datatypes.Address;
import org.web3j.abi.datatypes.Function;
import org.web3j.abi.datatypes.Type;
import org.web3j.abi.datatypes.generated.Uint256;
import org.web3j.abi.datatypes.generated.Uint8;
import org.web3j.protocol.Web3j;
import org.web3j.protocol.core.DefaultBlockParameterName;
import org.web3j.protocol.core.methods.request.Transaction;
import org.web3j.protocol.core.methods.response.EthCall;

@Service
public class BlockchainReadService {

  private final Web3j web3j;
  private final String facilityAddress;
  private final String treasuryAddress;

  public BlockchainReadService(Web3j web3j, ContractAddresses addresses) {
    this.web3j = web3j;
    this.facilityAddress = addresses.facility();
    this.treasuryAddress = addresses.treasury();
  }

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

    String encoded = FunctionEncoder.encode(function);
    EthCall response =
        web3j
            .ethCall(Transaction.createEthCallTransaction(null, facilityAddress, encoded), DefaultBlockParameterName.LATEST)
            .send();

    String value = response.getValue();
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

  public String getTreasuryTotalSupply() throws Exception {
    Function function = new Function("totalSupply", List.of(), List.of(new TypeReference<Uint256>() {}));
    String encoded = FunctionEncoder.encode(function);
    EthCall response =
        web3j
            .ethCall(Transaction.createEthCallTransaction(null, treasuryAddress, encoded), DefaultBlockParameterName.LATEST)
            .send();
    List<Type> decoded = FunctionReturnDecoder.decode(response.getValue(), function.getOutputParameters());
    return ((Uint256) decoded.get(0)).getValue().toString();
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
