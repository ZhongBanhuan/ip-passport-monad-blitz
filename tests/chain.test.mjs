import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import ganache from 'ganache';
import {createWalletClient,custom,getAddress,keccak256,parseEther,stringToHex} from 'viem';
import {abi,chainFor,publicClient,buyOffer,grantId,offerIdFor,projectHash,publishOffer,readGrant,readOffer,registerVersion,ZERO} from '../lib/chain.mjs';
import {deployAndSeed} from '../scripts/deploy.mjs';

const hash=value=>keccak256(stringToHex(value));
test('真实 EVM：报价、原子付款、版本关系、幂等与失败回滚',async t=>{
  const baseDir=resolve('.data');
  await mkdir(baseDir,{recursive:true});
  const dbPath=await mkdtemp(join(baseDir,'chain-test-'));
  const server=ganache.server({database:{dbPath},logging:{quiet:true},wallet:{totalAccounts:3},
    chain:{chainId:1337,hardfork:'shanghai'}});
  await server.listen(0,'127.0.0.1');
  t.after(async()=>{await server.close();await rm(dbPath,{recursive:true,force:true});});
  const config={rpcUrl:'http://127.0.0.1:'+server.address().port,chainId:1337};
  const {provider}=server;
  const wallet=createWalletClient({transport:custom(provider),chain:chainFor(config)});
  const [issuer,buyer,payee]=await wallet.getAddresses();
  const buyerProvider={request:arg=>arg.method==='eth_accounts'?Promise.resolve([buyer]):provider.request(arg)};
  const client=publicClient(config);
  const catalog={components:{templates:{workId:hash('work'),version:hash('v1')}},termsHash:hash('terms')};
  const {workId,version}=catalog.components.templates;
  const params={workId,version,termsHash:catalog.termsHash,priceWei:parseEther('0.1'),recipient:payee};
  const deployed=await deployAndSeed({client,wallet,account:issuer,catalog,recipient:payee});
  Object.assign(config,deployed);
  const {offerId}=deployed;
  assert.equal(offerId,offerIdFor(params));
  assert.equal((await readOffer(config,offerId)).active,true);
  const initial=await client.getBalance({address:payee});
  const grant=await buyOffer(config,{provider:buyerProvider,projectId:'project-a',offerId});
  assert.equal(grant.version,version);
  assert.equal(grant.projectHash,projectHash('project-a'));
  assert.equal(grant.buyer,getAddress(buyer));
  assert.equal((await client.getBalance({address:payee}))-initial,params.priceWei);
  const again=await buyOffer(config,{provider:buyerProvider,projectId:'project-a',offerId});
  assert.equal(again.txHash,grant.txHash);
  assert.equal((await client.getBalance({address:payee}))-initial,params.priceWei);
  assert.equal(await readGrant(config,grantId(offerId,buyer,'project-b')),null);
  assert.equal(await readGrant(config,grantId(offerId,issuer,'project-a')),null);
  assert.equal((await readGrant(config,grant.id)).termsHash,catalog.termsHash);
  const version2=hash('v2');
  await assert.rejects(registerVersion(config,{provider,workId,version:version2,parent:hash('missing')}));
  await assert.rejects(registerVersion(config,{provider:buyerProvider,workId,version:version2,parent:version}));
  const newOffer=await publishOffer(config,{provider,...params,parent:version,version:version2,termsHash:hash('terms-v2')});
  assert.equal((await readOffer(config,newOffer.id)).version,version2);
  assert.equal((await readGrant(config,grant.id)).version,version);
  await assert.rejects(client.simulateContract({account:buyer,address:config.contract,abi,functionName:'buy',
    args:[newOffer.id,projectHash('project-c')],value:1n}));
  // The registry has no payable receive function, so settlement to it fails atomically.
  const badOffer=await publishOffer(config,{...params,provider,recipient:config.contract});
  const failedHash=await wallet.writeContract({account:buyer,address:config.contract,abi,functionName:'buy',
    args:[badOffer.id,projectHash('project-c')],value:params.priceWei,gas:300000n});
  assert.equal((await client.waitForTransactionReceipt({hash:failedHash})).status,'reverted');
  assert.equal(await readGrant(config,grantId(badOffer.id,buyer,'project-c')),null);
  const close=await wallet.writeContract({account:issuer,address:config.contract,abi,functionName:'closeOffer',args:[offerId]});
  await client.waitForTransactionReceipt({hash:close});
  assert.equal((await readOffer(config,offerId)).active,false);
  assert.equal((await readGrant(config,grant.id)).txHash,grant.txHash);
  await assert.rejects(buyOffer(config,{provider:buyerProvider,offerId,projectId:'project-b'}));
  await assert.rejects(readGrant({...config,issuer:payee},grant.id));
});

