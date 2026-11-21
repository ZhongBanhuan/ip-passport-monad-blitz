import {handleApi} from '../lib/api.mjs';
import {getConfig} from '../lib/config.mjs';
export function sitePath(path) { return process.env.NEXT_PUBLIC_PAGES_BASE+path; }
async function saveLocalAudit(input,report) {
 const database=await new Promise((resolve,reject)=>{
  const open=indexedDB.open('ip-passport-audits',1);
  open.onupgradeneeded=()=>open.result.createObjectStore('reviews');
  open.onsuccess=()=>resolve(open.result);
  open.onerror=()=>reject(open.error);
 });
 const id=crypto.randomUUID();
 try {
  await new Promise((resolve,reject)=>{
   const tx=database.transaction('reviews','readwrite');
   tx.objectStore('reviews').add({input,report},id);
   tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
  });
 }finally{database.close();}
 return id;
}
export async function requestApi(path,options) {
 const request=new Request(new URL(path,location.origin),options);
 return handleApi(request,getConfig({}),saveLocalAudit);
}
