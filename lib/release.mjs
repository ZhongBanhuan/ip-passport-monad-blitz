import {zipSync} from 'fflate';
import {sha256} from 'viem';
import {catalog} from './rules.mjs';

const knownFiles = new Map([catalog.wrapper,...Object.values(catalog.components).flatMap(c=>c.files)].map(f=>[f.path,f]));
const receiptPath='IP-PASSPORT-GRANT.json';
export function grantReference(grant) {
  return {grantId:grant.id,chainId:grant.chainId,contract:grant.contract,issuer:grant.issuer,buyer:grant.buyer,txHash:grant.txHash};
}
export function encodeRelease(files,grant) {
  const payload=Object.create(null);
  for(const file of files) {
    const known=knownFiles.get(file.path);
    if(!known || known.sha256.toLowerCase()!==file.sha256.toLowerCase()) throw new Error('发布内容与登记版本不匹配');
    payload[file.path]=new TextEncoder().encode(known.text);
  }
  if(grant) payload[receiptPath]=new TextEncoder().encode(JSON.stringify(grantReference(grant),null,2));
  return zipSync(payload,{level:0,mtime:new Date(2000,0,1)});
}

export function inspectRelease(bytes) {
  if(bytes.length<22 || new DataView(bytes.buffer,bytes.byteOffset).getUint32(0,true)!==0x04034b50)
    throw new Error('请选择有效的发布 ZIP');
  // Accept canonical, single-disk archives. Cross-check indexed entries with streamed entries.
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--) {
    if(view.getUint32(i,true)===0x06054b50 && i+22+view.getUint16(i+20,true)===bytes.length){end=i;break;}
  }
  if(end<0 || view.getUint32(end+4,true)!==0) throw new Error('ZIP 目录不完整');
  const count=view.getUint16(end+10,true);
  let cursor=view.getUint32(end+16,true);
  const centralStart=cursor, entries=[], names=new Set();
  const decode=(start,len)=>new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(start,start+len));
  let total=0;
  if(!count || count>64 || cursor+view.getUint32(end+12,true)!==end) throw new Error('ZIP 目录或条目数量超出支持范围');
  for(let i=0;i<count;i++){
    if(cursor+46>end || view.getUint32(cursor,true)!==0x02014b50) throw new Error('ZIP 索引无效');
    const size=view.getUint32(cursor+24,true), nameLength=view.getUint16(cursor+28,true);
    const path=new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(cursor+46,cursor+46+nameLength));
    if(names.has(path) || !/^[a-zA-Z0-9._/-]+$/.test(path) || path.startsWith('/') || path.split('/').some(x=>!x || x==='..'||x==='.') || view.getUint16(cursor+8,true)!==0 || view.getUint16(cursor+10,true)!==0) throw new Error('请使用平台导出的未压缩 ZIP，文件路径须唯一');
    names.add(path);
    total+=size;
    if(total>256*1024) throw new Error('展开后的文件超过 256 KiB');
    const local=view.getUint32(cursor+42,true);
    if(local+30>centralStart || view.getUint32(local,true)!==0x04034b50 || view.getUint32(local+6,true)!==0 || view.getUint32(local+18,true)!==size || view.getUint32(local+22,true)!==size || view.getUint32(cursor+20,true)!==size || view.getUint32(local+14,true)!==view.getUint32(cursor+16,true)) throw new Error('ZIP 文件头与目录不一致');
    const len=view.getUint16(local+26,true), start=local+30+len+view.getUint16(local+28,true);
    if(start+size>centralStart || decode(local+30,len)!==path) throw new Error('ZIP 条目路径或长度不一致');
    entries.push({path,local,start,size});
    cursor+=46+nameLength+view.getUint16(cursor+30,true)+view.getUint16(cursor+32,true);
  }
  if(cursor!==end) throw new Error('ZIP 目录长度不一致');
  const files=[];
  let next=0,packagedGrant=null;
  for(const {path,start,local,size} of entries.sort((a,b)=>a.local-b.local)) {
    if(local!==next) throw new Error('ZIP 包含未登记的条目');
    next=start+size;
    if(path===receiptPath) packagedGrant=JSON.parse(decode(start,size));
    else files.push({path,sha256:sha256(bytes.subarray(start,next))});
  }
  if(next!==centralStart) throw new Error('ZIP 文件目录不连续');
  const components=Object.values(catalog.components).filter(c=>files.some(f=>f.path.startsWith(c.id+'/'))).map(({id,version})=>({id,version}));
  return {components,files,packagedGrant};
}
