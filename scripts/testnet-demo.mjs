// Only for a disposable hackathon demo. Both test keys live in process memory.
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {createWalletClient,http,parseEther} from 'viem';
import {generatePrivateKey,privateKeyToAccount} from 'viem/accounts';
import {chainFor,publicClient,projectHash,grantId,abi,readGrant} from '../lib/chain.mjs';
import {deployAndSeed} from './deploy.mjs';

const out=new URL('../deployments/monad-testnet.json',import.meta.url);
const rpcUrl=process.env.PASSPORT_RPC_URL||'https://rpc-testnet.monadinfra.com';
const config={chainId:10143,rpcUrl};
const catalog=JSON.parse(readFileSync(new URL('../lib/catalog.json',import.meta.url),'utf8'));
const client=publicClient(config);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
  if(existsSync(out)) throw new Error('已有测试网部署记录，请使用现有凭证');
  if(!existsSync(new URL('../contracts/IPPassport.json',import.meta.url))) throw new Error('请先执行 npm run compile');
  if(await client.getChainId()!==10143) throw new Error('测试网链 ID 核验失败');
  const issuer=privateKeyToAccount(generatePrivateKey());
  const buyer=privateKeyToAccount(generatePrivateKey());
  const create=account=>createWalletClient({account,chain:chainFor(config),transport:http(rpcUrl)});
  const issuerWallet=create(issuer);
  const buyerWallet=create(buyer);
  console.log('已核验网络 10143，演示签发地址',issuer.address);
  const funded=await fetch('https://agents.devnads.com/v1/faucet',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({chainId:10143,address:issuer.address}),signal:AbortSignal.timeout(30000)});
  if(!funded.ok) throw new Error('水龙头请求失败 HTTP '+funded.status);
  const minimum=parseEther('0.3');
  for(let i=0;await client.getBalance({address:issuer.address})<minimum;i++){
    if(i>=30) throw new Error('演示钱包未在 60 秒内收到足够的测试 MON');
    await wait(2000);
  }
  const transfer=await issuerWallet.sendTransaction({to:buyer.address,value:parseEther('0.15')});
  if((await client.waitForTransactionReceipt({hash:transfer})).status!=='success') throw new Error('测试钱包拨款失败');
  const deployed=await deployAndSeed({client,wallet:issuerWallet,account:issuer,catalog});
  console.log('合约与报价已登记',deployed.contract,deployed.offerId);
  const projectId='weekly-report-pro';
  const before=await client.getBalance({address:issuer.address});
  const start=Date.now();
  const txHash=await buyerWallet.writeContract({abi,address:deployed.contract,functionName:'buy',
    args:[deployed.offerId,projectHash(projectId)],value:parseEther('0.1')});
  const receipt=await client.waitForTransactionReceipt({hash:txHash});
  if(receipt.status!=='success')throw new Error('购买失败：'+txHash);
  const id=grantId(deployed.offerId,buyer.address,projectId);
  const after=await client.getBalance({address:issuer.address,blockNumber:receipt.blockNumber});
  if(after-before!==parseEther('0.1')) throw new Error('收款金额与报价不一致');
  const deadline=Date.now()+30000;
  while((await client.getBlock({blockTag:'finalized'})).number < receipt.blockNumber) {
    if(Date.now()>deadline) throw new Error('等待最终确认超时：'+txHash);
    await wait(1000);
  }
  const grant=await readGrant({...config,...deployed},id);
  if(!grant||grant.txHash!==txHash) throw new Error('链上复验失败');
  mkdirSync(new URL('../deployments/',import.meta.url),{recursive:true});
  const record={...deployed,buyer:buyer.address,projectId,grantId:id,grant,elapsedMs:Date.now()-start,
    recipientDeltaWei:(after-before).toString(),sampleTx:txHash,sample:{buyer:buyer.address,projectId,grantId:id,txHash}};
  writeFileSync(out,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
  writeFileSync(new URL('../deployments/default.json',import.meta.url),JSON.stringify(record,null,2)+'\n');
  console.log('已写入公开部署记录，凭证',id);
}
main().catch(error=>{console.error(error.shortMessage||error.message);process.exitCode=1;});

