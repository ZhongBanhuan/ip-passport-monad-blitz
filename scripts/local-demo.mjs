import ganache from 'ganache';
import {createWalletClient,http,parseEther} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {spawn} from 'node:child_process';
import {mkdir,writeFile} from 'node:fs/promises';
import {deployAndSeed} from './deploy.mjs';
import {abi,chainFor,grantId,projectHash,publicClient,readGrant} from '../lib/chain.mjs';
import catalog from '../lib/catalog.json' with {type:'json'};

const port=Number(process.env.LOCAL_RPC_PORT || 8545);
const server=ganache.server({chain:{chainId:1337,hardfork:'shanghai'},wallet:{totalAccounts:2},logging:{quiet:true}});
await server.listen(port,'127.0.0.1');
let web;
try {
  const rpcUrl='http://127.0.0.1:'+port;
  const cfg={rpcUrl,chainId:1337};
  const accounts=Object.values(server.provider.getInitialAccounts()).map(r=>privateKeyToAccount(r.secretKey));
  const client=publicClient(cfg);
  const makeWallet=account=>createWalletClient({account,chain:chainFor(cfg),transport:http(rpcUrl)});
  const deploy=await deployAndSeed({client,wallet:makeWallet(accounts[0]),account:accounts[0],catalog});
  const buyer=accounts[1],projectId='weekly-report-pro';
  const tx=await makeWallet(buyer).writeContract({address:deploy.contract,abi,functionName:'buy',args:[deploy.offerId,projectHash(projectId)],value:parseEther('0.1')});
  await client.waitForTransactionReceipt({hash:tx});
  const id=grantId(deploy.offerId,buyer.address,projectId);
  const sample={projectId,buyer:buyer.address,grantId:id,txHash:tx};
  const grant=await readGrant(deploy,id);
  await mkdir('.data',{recursive:true});
  await writeFile('.data/local-receipt.json',JSON.stringify({network:'local EVM',sample,grant},null,2));
  console.log('Local EVM grant issued and verified:',id);
  web=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',process.env.PORT||'3000'],{stdio:'inherit',env:{...process.env,PASSPORT_CHAIN_ID:'1337',PASSPORT_RPC_URL:rpcUrl,PASSPORT_CONTRACT:deploy.contract,PASSPORT_ISSUER:deploy.issuer,PASSPORT_RECIPIENT:deploy.recipient,PASSPORT_LOCAL_SAMPLE:JSON.stringify(sample)}});
  for(const signal of ['SIGINT','SIGTERM']) process.once(signal,()=>web.kill());
  await new Promise(resolve=>web.once('exit',resolve));
} finally {await server.close();}

