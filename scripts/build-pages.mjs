import {build} from 'esbuild';
import {createHash} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
const outdir=process.argv[2]||'dist/pages';
const base='/ip-passport-monad-blitz';
await mkdir(outdir,{recursive:true});
await build({entryPoints:['scripts/pages-entry.jsx'],bundle:true,outfile:path.join(outdir,'app.js'),minify:true,jsx:'automatic',format:'esm',target:'es2022',define:{'process.env.NODE_ENV':'"production"','process.env.NEXT_PUBLIC_PAGES_BASE':JSON.stringify(base)},plugins:[{name:'browser-audit',setup(b){b.onResolve({filter:/^\.\/transport$/},()=>({path:path.resolve('scripts/pages-transport.js')}));}}]});
const revision=createHash('sha256').update(await readFile(path.join(outdir,'app.js'))).update(await readFile(path.join(outdir,'app.css'))).digest('hex').slice(0,12);
for(const sub of ['','verify','author']) {
 const dir=path.join(outdir,sub);
 await mkdir(dir,{recursive:true});
 await writeFile(path.join(dir,'index.html'),'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>知识产权护照 · Skill 许可核验</title><link rel="stylesheet" href="'+base+'/app.css?v='+revision+'"><div id="root"></div><script type="module" src="'+base+'/app.js?v='+revision+'"></script></html>');
}
await writeFile(path.join(outdir,'.nojekyll'),'');
