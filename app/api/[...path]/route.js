import {handleApi} from '../../../lib/api.mjs';
import {getConfig} from '../../../lib/config.mjs';
import {saveAudit} from '../../../lib/audit-node.mjs';
export const dynamic='force-dynamic';
async function serve(request) {
  try {return await handleApi(request,getConfig(),saveAudit);}
  catch {return Response.json({error:'核验服务暂时不可用，请稍后重试'},{status:503});}
}
export {serve as GET,serve as POST};
