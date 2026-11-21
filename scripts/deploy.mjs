import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {createWalletClient,getAddress,http,parseEther} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {abi,chainFor,offerIdFor,publicClient,ZERO} from '../lib/chain.mjs';

export async function deployAndSeed({client,wallet,account,catalog,recipient}) {
  const issuer=getAddress(typeof account==='string'?account:account.address);
  recipient=getAddress(recipient||issuer);
  const chainId=await client.getChainId();
  if (wallet.chain.id!==chainId || ![10143,1337,31337].includes(chainId)) throw new Error('链 ID 不匹配');
  const artifact=JSON.parse(readFileSync(new URL('../contracts/IPPassport.json',import.meta.url),'utf8'));
  const target=catalog.components.templates;
  const params={workId:target.workId,version:target.version,termsHash:catalog.termsHash,priceWei:parseEther('0.1'),recipient};
  const deploymentGas=await client.estimateGas({account,data:artifact.bytecode});
  const deploymentTx=await wallet.deployContract({account,abi:artifact.abi,bytecode:artifact.bytecode,gas:deploymentGas});
  const deployed=await client.waitForTransactionReceipt({hash:deploymentTx});
  if(deployed.status!=='success'||!deployed.contractAddress) throw new Error('部署交易失败：'+deploymentTx);
  const contract=deployed.contractAddress;
  const {request}=await client.simulateContract({account,address:contract,abi,functionName:'publishOffer',
    args:[params.workId,params.version,ZERO,params.termsHash,params.priceWei,recipient]});
  const registrationTx=await wallet.writeContract({...request,gas:await client.estimateContractGas(request)});
  const published=await client.waitForTransactionReceipt({hash:registrationTx});
  if(published.status!=='success') throw new Error('报价登记失败；已部署合约：'+contract);
  return {chainId,contract,issuer,recipient,offerId:offerIdFor(params),deploymentTx,registrationTx,
    rpcUrl:wallet.chain.rpcUrls.default.http[0],explorerUrl:chainId===10143?'https://testnet.monadscan.com':''};
}

async function main(){
  const chainId=Number(process.env.PASSPORT_CHAIN_ID||10143);
  const rpcUrl=process.env.PASSPORT_RPC_URL||(chainId===10143?'https://testnet-rpc.monad.xyz':'http://127.0.0.1:8545');
  const cfg={rpcUrl,chainId};
  const key=process.env.PASSPORT_DEPLOYER_KEY;
  if(!key) throw new Error('为测试钱包设置 PASSPORT_DEPLOYER_KEY；私钥仅在当前进程中使用');
  const account=privateKeyToAccount(key);
  const client=publicClient(cfg);
  const wallet=createWalletClient({account,chain:chainFor(cfg),transport:http(rpcUrl)});
  const catalog=JSON.parse(readFileSync(new URL('../lib/catalog.json',import.meta.url),'utf8'));
  const result=await deployAndSeed({client,wallet,account,catalog,recipient:process.env.PASSPORT_RECIPIENT});
  const lines=[
    'PASSPORT_CHAIN_ID='+chainId,'PASSPORT_RPC_URL='+rpcUrl,'PASSPORT_CONTRACT='+result.contract,
    'PASSPORT_ISSUER='+result.issuer,'PASSPORT_RECIPIENT='+result.recipient,'PASSPORT_EXPLORER_URL='+result.explorerUrl
  ];
  console.log(JSON.stringify({...result,rpcUrl:undefined},null,2));
  if(process.argv.includes('--write-env')) writeFileSync('.env.local',lines.join('\n')+'\n',{flag:'wx',mode:0o600});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  main().catch(error=>{console.error(error.shortMessage||error.message);process.exitCode=1});
}

