import {
  createPublicClient, createWalletClient, custom, defineChain, encodeAbiParameters,
  getAddress, http, keccak256, parseAbi, parseAbiParameters, stringToHex, zeroAddress
} from 'viem';

export const ZERO = '0x' + '00'.repeat(32);
export const abi = parseAbi([
  'function issuer() view returns (address)',
  'function versions(bytes32 workId, bytes32 version) view returns (bytes32 parent, uint256 registeredAtBlock)',
  'function offers(bytes32 id) view returns (bytes32 workId, bytes32 version, bytes32 termsHash, uint256 price, address recipient, bool active)',
  'function grants(bytes32 id) view returns (bytes32 offerId, address buyer, bytes32 projectHash, uint256 blockNumber, uint256 timestamp)',
  'function registerVersion(bytes32 workId, bytes32 version, bytes32 parent)',
  'function publishOffer(bytes32 workId, bytes32 version, bytes32 parent, bytes32 termsHash, uint256 price, address recipient) returns (bytes32)',
  'function closeOffer(bytes32 offerId)',
  'function buy(bytes32 offerId, bytes32 projectHash) payable returns (bytes32)',
  'event GrantIssued(bytes32 indexed id, bytes32 indexed offerId, address indexed buyer, bytes32 projectHash)',
  'error Unauthorized()', 'error InvalidInput()', 'error UnknownVersion()', 'error MismatchedParent()',
  'error OfferUnavailable()', 'error AlreadyPurchased(bytes32 id)', 'error PaymentFailed()'
]);

export function projectHash(projectId) {
  const clean = projectId.trim();
  if (!clean) throw new Error('请输入 Skill 项目标识');
  return keccak256(stringToHex(clean));
}

function abiHash(types, values) {
  return keccak256(encodeAbiParameters(parseAbiParameters(types), values));
}
export function grantId(offerId,buyer,projectId) {
  return abiHash('bytes32,address,bytes32',[offerId,getAddress(buyer),projectHash(projectId)]);
}
export function offerIdFor({workId,version,termsHash,priceWei,recipient}) {
  return abiHash('bytes32,bytes32,bytes32,uint256,address',[workId,version,termsHash,BigInt(priceWei),getAddress(recipient)]);
}

export function chainFor(config) {
  const id = Number(config.chainId);
  if (id !== 10143 && id !== 1337 && id !== 31337) throw new Error('本项目仅接受 Monad 测试网或本地 EVM');
  return defineChain({ id, name:id===10143?'Monad Testnet':'Local EVM',
    nativeCurrency:{name:id===10143?'Test MON':'Local test token',symbol:id===10143?'MON':'ETH',decimals:18},
    rpcUrls:{default:{http:[config.rpcUrl]}}, testnet:true });
}
export function publicClient(config) {
  if (!config.rpcUrl) throw new Error('缺少 RPC 配置');
  return createPublicClient({chain:chainFor(config),transport:http(config.rpcUrl,{retryCount:1,timeout:10000}),
    pollingInterval:750,cacheTime:0});
}
async function assertChain(client,config) {
  if(await client.getChainId()!==Number(config.chainId)) throw new Error('RPC 或钱包网络与部署记录不匹配');
}
async function registry(config) {
  if (!config.contract || !config.issuer) throw new Error('待配置合约地址与已审核签发地址');
  const client = publicClient(config);
  await assertChain(client,config);
  const base={abi,address:getAddress(config.contract)};
  const issuer=await client.readContract({...base,functionName:'issuer'});
  if(getAddress(issuer)!==getAddress(config.issuer)) throw new Error('合约签发方与审核记录不匹配');
  return {client,base,issuer};
}
function unpackOffer(config,id,issuer,row) {
  const [workId,version,termsHash,price,recipient,active]=row;
  if(recipient===zeroAddress) return null;
  return {id,workId,version,termsHash,priceWei:price.toString(),recipient,active,issuer,
    contract:getAddress(config.contract),chainId:Number(config.chainId)};
}
export async function readOffer(config,id) {
  const {client,base,issuer}=await registry(config);
  return unpackOffer(config,id,issuer,await client.readContract({...base,functionName:'offers',args:[id]}));
}
export async function readGrant(config,id) {
  const {client,base,issuer}=await registry(config);
  const [offerId,buyer,scope,blockNumber,timestamp]=await client.readContract({...base,functionName:'grants',args:[id]});
  if(buyer===zeroAddress) return null;
  if (Number(config.chainId)===10143) {
    const finalized=await client.getBlock({blockTag:'finalized'});
    if(finalized.number<blockNumber) throw new Error('交易等待最终确认，请稍后复验');
  }
  const [offerRow,logs]=await Promise.all([
    client.readContract({...base,functionName:'offers',args:[offerId]}),
    client.getContractEvents({...base,eventName:'GrantIssued',args:{id,offerId,buyer},fromBlock:blockNumber,toBlock:blockNumber,strict:true})
  ]);
  const log=logs.find(entry=>!entry.removed && entry.args.projectHash===scope);
  if(!log) throw new Error('未能匹配链上签发事件');
  const receipt=await client.getTransactionReceipt({hash:log.transactionHash});
  if(receipt.status!=='success'||receipt.blockHash!==log.blockHash) throw new Error('交易回执未确认');
  const offer=unpackOffer(config,offerId,issuer,offerRow);
  if(!offer) throw new Error('报价记录缺失');
  return {...offer,id,offerId,buyer,projectHash:scope,blockNumber:Number(blockNumber),timestamp:Number(timestamp),
    txHash:log.transactionHash,gasUsed:receipt.gasUsed.toString()};
}

async function walletOnNetwork(config,provider) {
  if(!provider) throw new Error('请连接兼容的浏览器钱包');
  const chain=chainFor(config);
  const wallet=createWalletClient({chain,transport:custom(provider)});
  await assertChain(wallet,config);
  let accounts=await wallet.getAddresses();
  if(!accounts.length) accounts=await wallet.requestAddresses();
  if(!accounts.length) throw new Error('钱包未提供账户');
  return {wallet,account:accounts[0]};
}

async function transact(config,provider,functionName,args,value=0n,expectedAccount) {
  const start=Date.now();
  const {client,base}=await registry(config);
  const {wallet,account}=await walletOnNetwork(config,provider);
  if(expectedAccount && getAddress(account)!==getAddress(expectedAccount)) throw new Error('钱包账户已切换，请重新核验');
  const {request}=await client.simulateContract({...base,account,functionName,args,value});
  const gas=await client.estimateContractGas(request);
  const txHash=await wallet.writeContract({...request,gas});
  const receipt=await client.waitForTransactionReceipt({hash:txHash,timeout:90000});
  if(receipt.status!=='success') throw new Error('交易失败，请从链上交易记录重试');
  return {txHash,blockNumber:Number(receipt.blockNumber),gasUsed:receipt.gasUsed.toString(),elapsedMs:Date.now()-start};
}

export function registerVersion(config,{workId,version,parent=ZERO,provider}) {
  return transact(config,provider,'registerVersion',[workId,version,parent]);
}
export async function publishOffer(config,params) {
  const {workId,version,parent=ZERO,termsHash,priceWei,recipient,provider}=params;
  const receipt=await transact(config,provider,'publishOffer',[workId,version,parent,termsHash,BigInt(priceWei),recipient]);
  return {...receipt,id:offerIdFor(params)};
}
export async function buyOffer(config,{offerId,projectId,buyer,provider}) {
  const {account}=await walletOnNetwork(config,provider);
  if(buyer && getAddress(buyer)!==getAddress(account)) throw new Error('买方钱包已切换，请重新确认条款');
  const id=grantId(offerId,account,projectId);
  const existing=await readGrant(config,id);
  if(existing) return {...existing,elapsedMs:0};
  const offer=await readOffer(config,offerId);
  if(!offer?.active) throw new Error('此报价已关闭或尚未登记');
  let receipt;
  try {
    receipt=await transact(config,provider,'buy',[offerId,projectHash(projectId)],BigInt(offer.priceWei),account);
  } catch(error) {
    const retry=await readGrant(config,id).catch(()=>null);
    if(retry) return {...retry,elapsedMs:0};
    throw error;
  }
  // A successful spend should be recoverable by grantId even when finality or RPC lags.
  const started=Date.now();
  for (;;) {
    try {
      const grant=await readGrant(config,id);
      if(grant) return {...grant,elapsedMs:receipt.elapsedMs+Date.now()-started};
    } catch (error) {
      if(Date.now()-started>10000) throw error;
    }
    if(Date.now()-started>10000) throw new Error('交易已提交，请使用凭证编号复验：'+id);
    await new Promise(resolve=>setTimeout(resolve,750));
  }
}

export async function deployRegistry(config,{provider}) {
  const {wallet,account}=await walletOnNetwork(config,provider);
  const client=publicClient(config);
  await assertChain(client,config);
  const res=await fetch('/IPPassport.json');
  if(!res.ok) throw new Error('部署字节码不可用，请先运行编译脚本');
  const artifact=await res.json();
  const start=Date.now();
  const gas=await client.estimateGas({account,data:artifact.bytecode});
  const txHash=await wallet.deployContract({account,abi:artifact.abi,bytecode:artifact.bytecode,gas});
  const receipt=await client.waitForTransactionReceipt({hash:txHash,timeout:90000});
  if(receipt.status!=='success'||!receipt.contractAddress) throw new Error('合约部署失败');
  return {contract:receipt.contractAddress,issuer:account,txHash,blockNumber:Number(receipt.blockNumber),
    gasUsed:receipt.gasUsed.toString(),elapsedMs:Date.now()-start};
}

