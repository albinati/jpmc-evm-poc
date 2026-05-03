export type EventLog = {
  name: string
  contract: string
  address: string
  args: Record<string, string>
}

export type TxReceipt = {
  transactionHash: string
  blockNumber: string | number
  status: string
  gasUsed: string | number
  contractAddress: string
  from: string
  events: EventLog[]
}

export type ApiConfig = {
  chainId: number
  rpcUrl: string
  facilityContract: string
  treasuryContract: string
  titleContract: string
  tradeContract: string
  bankerAddress: string | null
  complianceAddress: string | null
  liquidationAgentAddress: string | null
  workflowSignerConfigured: boolean
  nextResetAt: number | null
}

export type Facility = {
  facilityId: number
  borrower: string | null
  state: string
  lockedCashWei: string
  titleTokenId: string
  tradeFinanceRefId: string
  stateCode: string
}

export type TreasuryStatus = {
  name: string
  symbol: string
  decimals: number
  paused: boolean
  totalSupply: string
}

export type TreasuryHolder = {
  address: string
  balance: string
  blacklisted: boolean
  frozenUntil: string
}

export type Title = {
  tokenId: string
  owner: string
  tokenURI: string
  propertyAddress: string
  lastSalePrice: string
  lastSaleTimestamp: string
  isEncumbered: boolean
  jurisdiction: string
}

export type Invoice = {
  invoiceId: string
  receivableParty: string
  payableParty: string
  amount: string
  dueDate: string
  settled: boolean
  currentSupply: string
  invoiceReference: string
}

export type Role = 'banker' | 'compliance' | 'liquidationAgent'

export type ApiError = { error: string; status: number }
