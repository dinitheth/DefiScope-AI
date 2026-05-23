// FlowPulseRegistry on Base Sepolia
// This is a placeholder ABI for the strategy registry contract.
// The contract stores strategy hashes on-chain for verifiability.

export const FLOWPULSE_REGISTRY_ADDRESS = "0x0000000000000000000000000000000000000000"; // TODO: deploy and update

export const FLOWPULSE_REGISTRY_ABI = [
  {
    "inputs": [
      { "name": "strategyHash", "type": "bytes32" },
      { "name": "allocationJson", "type": "string" }
    ],
    "name": "publishStrategy",
    "outputs": [{ "name": "strategyId", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "name": "owner", "type": "address" },
      { "indexed": true, "name": "strategyId", "type": "uint256" },
      { "indexed": false, "name": "strategyHash", "type": "bytes32" },
      { "indexed": false, "name": "timestamp", "type": "uint256" }
    ],
    "name": "StrategyPublished",
    "type": "event"
  }
] as const;

export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_SEPOLIA_RPC = "https://sepolia.base.org";
export const BASESCAN_TESTNET_URL = "https://sepolia.basescan.org";
