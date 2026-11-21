import {build} from 'esbuild';
import {cp,mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const assets={};
async function collect(root,prefix){
 for(const entry of await readdir(root,{withFileTypes:true})){
  const sub=path.join(root,entry.name),url=prefix+'/'+entry.name;
  if(entry.isDirectory()) await collect(sub,url);
  else if(!entry.name.endsWith('.map')) assets[url]=(await readFile(sub)).toString('base64');
 }
}
for(const [name,url] of [['index','/'],['author','/author'],['verify','/verify']]){
 assets[url]=(await readFile('.next/server/app/'+name+'.html')).toString('base64');
}
await collect('.next/static','/_next/static');
await collect('public','');
await mkdir('dist/server',{recursive:true});
await mkdir('dist/.openai',{recursive:true});
await cp('.openai/hosting.json','dist/.openai/hosting.json');
await build({entryPoints:['scripts/worker.mjs'],outfile:'dist/server/index.js',bundle:true,format:'esm',target:'es2022',platform:'browser',minify:true,define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'site-assets',setup(b){b.onResolve({filter:/^site-assets$/},()=>({path:'assets',namespace:'virtual'}));b.onLoad({filter:/.*/,namespace:'virtual'},()=>({contents:JSON.stringify(assets),loader:'json'}));}}]});

