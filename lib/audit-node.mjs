import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
export async function saveAudit(input,report) {
  const dir=join(process.cwd(),'.data','audits');
  await mkdir(dir,{recursive:true});
  const id=randomUUID();
  await writeFile(join(dir,id+'.json'),JSON.stringify({input,report}),{flag:'wx',mode:0o600});
  return id;
}
