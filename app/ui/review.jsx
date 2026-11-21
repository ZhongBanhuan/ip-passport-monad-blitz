"use client";
import {useState} from "react";
import {buildManifest,catalog} from "../../lib/rules.mjs";
import {buyOffer,grantId} from "../../lib/chain.mjs";
import {Icon,PassportArt} from "./identity";
import {TextPanel,Notice,useJob} from "./common";
import {useCheck} from "./use-check";
import {requestApi} from "./transport";
import {shorten,saveFile,ZERO_ADDRESS} from "./tools";

export default function Review({state,wallet,connect}) {
  const [edition,setEdition]=useState("basic");
  const [project,setProject]=useState("weekly-report");
  const [sample,setSample]=useState(null);
  const [consent,setConsent]=useState("");
  const [purchase,setPurchase]=useState(null);
  const [downloaded,setDownloaded]=useState("");
  const job=useJob();
  const config=state?.config, pro=edition==="pro", name=project.trim();
  const buyer=sample?.buyer || wallet || ZERO_ADDRESS;
  const currency=config && Number(config.chainId)!==10143 ? "本地 ETH" : "测试 MON";
  const scope=JSON.stringify([name,buyer,state?.offerId]);
  const id=pro && name && (sample?.grantId || (buyer!==ZERO_ADDRESS && state?.offerId && grantId(state.offerId,buyer,name)));
  const request=name ? {projectId:name,buyer,purpose:catalog.purpose,...buildManifest(pro,true),...(id?{grantId:id}:{})} : null;
  const check=useCheck(request);
  const result=check.result, ready=result?.decision==="ready";
  const grant=ready && pro ? result.grant : null;
  const needsPayment=pro && !sample && result?.decision==="blocked";
  const quote=state?.offer?.active && !state.chainError;
  function select(value){
    setEdition(value);setSample(null);setConsent("");setDownloaded("");
  }
  function showSample(){
    const example=config.sample;
    setSample(example);setProject(example.projectId);setEdition("pro");setDownloaded("");setConsent("");
  }
  function exportAudit(){
    if (!result) return;
    saveFile(name+"-审核记录.json",{format:"ip-passport-review/1",request,result,catalogCommit:catalog.commit,sourceUrl:catalog.sourceUrl,
      mitText:catalog.mitText,termsText:catalog.termsText,rightsText:catalog.rightsText,grant:result.grant,chainId:config?.chainId,contract:config?.contract});
  }
  async function download(){
    const response=await requestApi("/api/package",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(request)});
    if(!response.ok){check.retry();throw new Error("下载前复核未通过，请查看审核结果。");}
    const link=document.createElement("a"),url=URL.createObjectURL(await response.blob());
    link.href=url;link.download=name+".zip";link.click();setTimeout(()=>URL.revokeObjectURL(url),1500);
    setDownloaded(JSON.stringify(request));
  }
  async function buy(){
    if (consent!==scope || !quote || !name || sample) return;
    const account=await connect();
    const receipt=await buyOffer(config,{offerId:state.offerId,projectId:name,buyer:account,provider:window.ethereum});
    setPurchase(receipt);check.retry();
  }
  const title=check.pending?"核验中":!name?"请填写项目标识":check.error?"核验未完成":ready?"可发布":needsPayment?"待商业授权":result?.decision==="review"?"需人工复核":"缺少授权";
  return <>
    <section className="hero"><div className="hero-copy"><h1>周报生成 Skill</h1><p>商业分发许可审核</p></div><PassportArt/></section>
    <div className="columns"><div className="maincol"><section className="sheet">
      <div className="section-head"><h2>发布配置</h2>{config?.sample && <button className="linkbutton" disabled={job.busy} onClick={showSample}><Icon name="fingerprint" size={16}/>体验已授权示例</button>}</div>
      <label>项目标识<input value={project} maxLength={100} disabled={job.busy} onChange={e=>setProject(e.target.value)}/></label>
      <fieldset className="edition-picker"><legend>发布版本</legend>{[["basic","基础版","Markdown 转换器"],["pro","专业版","转换器 + 12 套模板"]].map(([key,label,summary])=>
        <label key={key} className={"choice"+(edition===key?" selected":"")}><input type="radio" name="edition" checked={edition===key} disabled={job.busy} onChange={()=>select(key)}/><span><strong>{label}</strong><small>{summary}</small></span></label>)}</fieldset>
      {sample && <div className="sample-actions"><span>示例买方 <code>{shorten(sample.buyer,5)}</code></span><button className="linkbutton" onClick={()=>select("pro")}>退出示例</button></div>}
    </section><section className="sheet"><div className="section-head"><h2>组件许可</h2><a className="quiet" href={catalog.sourceUrl} target="_blank" rel="noreferrer">源码 <Icon name="external" size={14}/></a></div>
      <div className="component-row"><span className="tile-icon"><Icon name="code"/></span><div className="grow"><h3>Markdown 转换器</h3><small>MIT · 声明随包附上</small></div><span className="tag ok"><Icon name="check" size={14}/>可商用</span></div>
      {pro && <div className="component-row"><span className="tile-icon"><Icon name="layers"/></span><div className="grow"><h3>专业报告模板</h3><small>单项目 · 永久分发许可</small></div><span className={"tag "+(grant?"ok":"warn")}>{grant?"已授权":check.pending?"核验中":"需核验授权"}</span></div>}
      <details className="details"><summary>许可原文与版本</summary><TextPanel title="MIT 许可" text={catalog.mitText} name="LICENSE-MIT.txt"/>
        {pro && <><TextPanel title="模板商业许可" text={catalog.termsText} name="COMMERCIAL-LICENSE.txt"/><details><summary>模板版本与文件</summary><code>{catalog.components.templates.version}</code><ul>{catalog.components.templates.files.map(f=><li key={f.path}>{f.path}</li>)}</ul></details></>}
      </details></section></div>
      <aside><section className="sheet decision-card"><div className="section-head"><h2>审核结果</h2><Icon name="shield"/></div>
        <div className={"status-mark "+(ready?"ok":"warn")} role="status"><Icon name={ready?"check":"key"}/><strong>{title}</strong></div>
        <dl className="data"><div><dt>发布版本</dt><dd>{pro?"专业版":"基础版"}</dd></div><div><dt>{grant?"已付授权费":"授权费"}</dt><dd>{pro?"0.1 "+currency:"免费"}</dd></div></dl>
        {ready && <button className="primary full" disabled={job.busy} onClick={()=>job.run(download)}><Icon name="download"/>下载发布包</button>}
        {needsPayment && <><TextPanel title="查看单项目授权条款" text={catalog.termsText} name="COMMERCIAL-LICENSE.txt"/>
          <label className="check"><input type="checkbox" checked={consent===scope} onChange={e=>setConsent(e.target.checked?scope:"")}/>我同意本次授权条款</label>
          <button className="primary full" disabled={job.busy || !quote || consent!==scope} onClick={()=>job.run(buy)}>支付 0.1 {currency}</button>
          {!quote && <p className="subtle">{state?"报价暂不可用":"正在读取报价…"}</p>}</>}
        {result && <div className="actions"><button className="linkbutton" onClick={exportAudit}><Icon name="file" size={16}/>导出审核记录</button></div>}
        {(check.error || result?.decision==="review") && <button className="secondary" onClick={check.retry}>重新核验</button>}
        {result && !ready && !needsPayment && <Notice text={result.issues.join(" ")}/>}
        {grant && <details className="details"><summary>查看链上凭证</summary><dl className="data"><div><dt>签发方</dt><dd><code>{shorten(grant.issuer)}</code></dd></div><div><dt>凭证</dt><dd><code title={grant.id}>{shorten(grant.id)}</code></dd></div><div><dt>交易</dt><dd>{config?.explorerUrl?<a href={config.explorerUrl+"/tx/"+grant.txHash} target="_blank" rel="noreferrer">{shorten(grant.txHash)}</a>:shorten(grant.txHash)}</dd></div><div><dt>Gas</dt><dd>{grant.gasUsed}</dd></div>{purchase?.id===grant.id && <div><dt>确认耗时</dt><dd>{purchase.elapsedMs} ms</dd></div>}</dl></details>}
        {downloaded===JSON.stringify(request) && <p role="status">已生成发布包</p>}<Notice text={job.error || check.error}/>
      </section></aside></div>
  </>;
}
