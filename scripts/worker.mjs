import assets from 'site-assets';
import {getConfig} from '../lib/config.mjs';
import {handleApi} from '../lib/api.mjs';
const contentTypes={js:'application/javascript',css:'text/css',json:'application/json',woff2:'font/woff2',svg:'image/svg+xml',ico:'image/x-icon',png:'image/png'};
export default {async fetch(request,env){
 const url=new URL(request.url),key=url.pathname.replace(/\/$/,'') || '/';
 if(key.startsWith('/api/')){
  try {
   return await handleApi(request,getConfig(env),async(input,report)=>{
    const id=crypto.randomUUID();
    await env.DB.prepare('INSERT INTO audit_records(id,checked_at,decision,record_json) VALUES (?,?,?,?)').bind(id,report.checkedAt,report.decision,JSON.stringify({input,report})).run();
    return id;
   });
  } catch {return Response.json({error:'当前无法保存或读取审核记录，请稍后重试'},{status:503});}
 }
 if(!Object.hasOwn(assets,key))return new Response('页面不存在',{status:404});
 const type=contentTypes[key.split('.').pop()] || 'text/html; charset=utf-8';
 const body=Uint8Array.from(atob(assets[key]),c=>c.charCodeAt(0));
 return new Response(request.method==='HEAD'?null:body,{headers:{'Content-Type':type,'Cache-Control':key.startsWith('/_next/static/')?'public,max-age=31536000,immutable':'no-cache'}});
}};
