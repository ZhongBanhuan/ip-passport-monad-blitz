import {catalog,evaluateCheck} from './rules.mjs';
import {readGrant,readOffer,offerIdFor} from './chain.mjs';
import {encodeRelease,inspectRelease,grantReference} from './release.mjs';

const hexId = /^0x[0-9a-fA-F]{64}$/;
const json = (data,status=200) => Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const inputLimit = 256 * 1024;

async function boundedBytes(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error('请求内容为空');
  const chunks = [];
  let total = 0;
  for (;;) {
    const {value,done} = await reader.read();
    if (done) break;
    total += value.length;
    if (total > inputLimit) { await reader.cancel(); throw new Error('文件超出 256 KiB 演示上限'); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset=0;
  for(const chunk of chunks){ bytes.set(chunk,offset); offset+=chunk.length; }
  return bytes;
}
export async function handleApi(request,config,saveAudit) {
  const path=new URL(request.url).pathname.replace(/\/$/,'');
  const workId=catalog.components.templates.workId;
  const offerId=config.recipient ? offerIdFor({workId,version:catalog.components.templates.version,termsHash:catalog.termsHash,priceWei:catalog.priceWei,recipient:config.recipient}):null;
  if(path==='/api/config' && request.method==='GET') {
    let offer=null,chainError=null;
    if(offerId && config.contract) {
      try { offer=await readOffer(config,offerId); }
      catch { chainError='链上报价暂时无法读取，请稍后重试'; }
    }
    return json({config,catalog,workId,offerId,offer,chainError});
  }
  if(path.startsWith('/api/grants/') && request.method==='GET'){
    const id=path.split('/').pop();
    if(!hexId.test(id)) return json({error:'凭证编号格式错误'},400);
    try { const grant=await readGrant(config,id); return grant?json(grant):json({error:'链上未找到此凭证'},404); }
    catch { return json({error:'无法确认链上凭证，请检查部署与 RPC'},503); }
  }
  if(!['/api/check','/api/package','/api/inspect'].includes(path)) return json({error:'未知接口'},404);
  if(request.method!=='POST') return json({error:'请使用 POST'},405);
  let input;
  try {
    const bytes=await boundedBytes(request);
    if(path==='/api/inspect') return json(inspectRelease(bytes));
    input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    if(!input || Array.isArray(input) || typeof input!=='object' || typeof input.projectId!=='string' || input.projectId.length>128 || !Array.isArray(input.components) || !Array.isArray(input.files) || input.files.length>128 || input.components.length>64) throw new Error('发布清单或项目标识无效');
    if(input.grantId && !hexId.test(input.grantId)) throw new Error('凭证编号格式错误');
  } catch(err){ return json({error:err.message},400); }
  let grant=null,chainError=null;
  if(input.grantId) {
    try { grant=await readGrant(config,input.grantId); }
    catch { chainError='链上凭证暂时无法确认'; }
  }
  const result=evaluateCheck(input,{...config,grant,chainError,workId,offerId:grant?.offerId || offerId});
  if(Object.hasOwn(input,'packagedGrant') && input.components.some(c=>c?.id==='templates') && grant) {
    const expected=grantReference(grant);
    if(!Object.entries(expected).every(([key,value])=>input.packagedGrant?.[key]===value)) {
      const reason='实际发布包所附签发方或授权凭证与链上记录不一致。';
      result.items.push({id:'grant-file',status:'review',reason});
      result.issues.push(reason);
      result.decision='review';
    }
  }
  const report={...result,grant,checkedAt:new Date().toISOString()};
  if(path==='/api/package' && result.decision!=='ready') return json(report,409);
  report.auditId=await saveAudit(input,report);
  if(path==='/api/package') {
    const bytes=encodeRelease(input.files,input.components.some(c=>c?.id==='templates')?grant:null);
    return new Response(bytes,{headers:{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="weekly-report-skill.zip"','Cache-Control':'no-store'}});
  }
  return json(report);
}
