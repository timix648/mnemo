export const MNEMO_TESTNET = {
  PACKAGE_ID: "0x140618622e96fe604e8fd1e8a752e1fe44726cdb0622a18020a61955ce918a60",
  REGISTRY_ID: "0xa13e1c5b27d1b5e41c780c3ed2a572219b20bf1c18c5a55f4289ab04e2f515f3",
  CHAIN_ID: "4c78adac",
  RPC_URL: "https://fullnode.testnet.sui.io:443",
  EXPLORER: "https://testnet.suivision.xyz",
  WALRUS_AGGREGATOR: "https://aggregator.walrus-testnet.walrus.space",
  WALRUS_PUBLISHER: "https://publisher.walrus-testnet.walrus.space",
  CLOCK_ID: "0x6",
} as const;

export const DEV_TEST_USER = {
  user_id: "46b364ee-6e2b-4e98-98b7-c50e0112c968",
  sui_address: "0x338f111781ccc5fb4110c35781a615aac436b92d27e8543961979a5644236fbd",
  proxy_token: "test-fa742ce2e64d45f3",
  default_namespace_id: "efab090e-21bd-49e0-91c2-99f596a8a8d2",
} as const;