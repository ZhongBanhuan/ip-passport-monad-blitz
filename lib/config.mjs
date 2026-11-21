import defaults from '../deployments/default.json' with {type:'json'};

export function getConfig(env = process.env) {
  const chainId = Number(env.PASSPORT_CHAIN_ID || defaults.chainId || 10143);
  const local = chainId !== 10143;
  const issuer = env.PASSPORT_ISSUER || defaults.issuer || '';
  return {
    chainId, issuer,
    contract: env.PASSPORT_CONTRACT || defaults.contract || '',
    recipient: env.PASSPORT_RECIPIENT || defaults.recipient || issuer,
    rpcUrl: env.PASSPORT_RPC_URL || defaults.rpcUrl || (local ? 'http://127.0.0.1:8545' : 'https://testnet-rpc.monad.xyz'),
    explorerUrl: env.PASSPORT_EXPLORER_URL || (local ? '' : 'https://testnet.monadscan.com'),
    sample: local && env.PASSPORT_LOCAL_SAMPLE ? JSON.parse(env.PASSPORT_LOCAL_SAMPLE)
      : (!env.PASSPORT_CONTRACT ? defaults.sample || null : null)
  };
}
