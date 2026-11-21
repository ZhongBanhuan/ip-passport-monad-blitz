import test from 'node:test';
import assert from 'node:assert/strict';
import {handleApi} from '../lib/api.mjs';
import {buildManifest,catalog} from '../lib/rules.mjs';
import {getConfig} from '../lib/config.mjs';
import {inspectRelease} from '../lib/release.mjs';
import {zipSync} from 'fflate';

const config=getConfig({});
const makeInput=(templates,notice)=>({projectId:'weekly-report',buyer:'',purpose:catalog.purpose,...buildManifest(templates,notice)});
const audit=async()=> 'review-id';
const request=(path,input)=>new Request('http://localhost/api/'+path,{method:'POST',body:JSON.stringify(input)});
test('base release produces reproducible contents, and actual file changes require review',async()=>{
 const input=makeInput(false,true);
 const reply=await handleApi(request('package',input),config,audit);
 assert.equal(reply.status,200);
 const actual=inspectRelease(new Uint8Array(await reply.arrayBuffer()));
 const checked=await handleApi(request('check',{...input,...actual}),config,audit);
 assert.equal((await checked.json()).decision,'ready');
 const altered=zipSync({'core/report.mjs':new TextEncoder().encode('modified'),'core/LICENSE.txt':new TextEncoder().encode(catalog.mitText)},{level:0});
 const changed=inspectRelease(altered);
 const result=await handleApi(request('check',{...input,...changed}),config,audit);
 assert.equal((await result.json()).decision,'review');
});
test('release rejects incomplete notices or unpaid templates including client-injected approval',async()=>{
 for(const input of [makeInput(false,false),makeInput(true,true)]){
  const res=await handleApi(request('package',{...input,decision:'ready',grant:{id:'made-up'}}),config,audit);
  assert.equal(res.status,409);
 }
});
test('rejects incomplete ZIP, malformed requests and oversized input',async()=>{
 assert.throws(()=>inspectRelease(new Uint8Array(60)));
 assert.equal((await handleApi(request('check',{}),config,audit)).status,400);
 assert.equal((await handleApi(request('check','x'.repeat(300000)),config,audit)).status,400);
});

