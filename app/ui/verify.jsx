"use client";
import {useRef,useState} from "react";
import {requestApi} from "./transport";
import {catalog,buildManifest} from "../../lib/rules.mjs";
import {api,shorten,validHash,displayError} from "./tools";
import {Result,Notice,useJob} from "./common";
import {Icon} from "./identity";
import {useCheck} from "./use-check";

export default function Verify({state}) {
  const [mode,setMode]=useState("files"),[pack,setPack]=useState(null),[archive,setArchive]=useState(null);
  const [project,setProject]=useState(""),[buyer,setBuyer]=useState(""),[filesLabel,setFilesLabel]=useState("");
  const [loading,setLoading]=useState(false),[error,setError]=useState("");
  const [id,setId]=useState(""),[grant,setGrant]=useState(null);
  const lookup=useJob(), sequence=useRef(0);
  const request=!error && !loading && pack && project.trim() && {...pack.request,...archive?.manifest,projectId:project.trim(),buyer};
  const check=useCheck(mode==="files"?request:null, archive ? pack?.result?.packageHash : null);
  function useSample(){
    const sample=state.config.sample;
    ++sequence.current;setLoading(false);setArchive(null);setError("");setFilesLabel("已成交示例");
    setProject(sample.projectId);setBuyer(sample.buyer);
    setPack({request:{projectId:sample.projectId,buyer:sample.buyer,grantId:sample.grantId,purpose:catalog.purpose,...buildManifest(true,true)}});
  }
  async function importFiles(list){
    const files=Array.from(list);
    if(!files.length)return;
    const seq=++sequence.current;
    setLoading(true);setError("");
    try{
      const records=files.filter(f=>/\.json$/i.test(f.name));
      const archives=files.filter(f=>/\.zip$/i.test(f.name));
      if(records.length>1 || archives.length>1 || records.length+archives.length!==files.length) throw Error("请选择一份审核记录和至多一个发布包。");
      let record=null, imported=null;
      if(records.length){
        if(records[0].size>256*1024)throw Error("审核记录超过 256 KiB。");
        record=JSON.parse(await records[0].text());
        if(record?.format!=="ip-passport-review/1" || !record.request || !validHash(record.result?.packageHash) || typeof record.request.projectId!=="string" || typeof record.request.buyer!=="string")throw Error("请选择工作台导出的审核记录。");
        if(record.catalogCommit!==catalog.commit || record.mitText!==catalog.mitText || record.termsText!==catalog.termsText || record.rightsText!==catalog.rightsText)throw Error("许可原文或来源版本不匹配，需人工复核。");
      }
      if(archives.length){
        const file=archives[0];
        if(file.size>256*1024)throw Error("发布包超过 256 KiB。");
        const response=await requestApi("/api/inspect",{method:"POST",headers:{"Content-Type":"application/zip"},body:file});
        const manifest=await response.json();
        if(!response.ok)throw Error(manifest.error || "无法读取 ZIP。");
        imported={name:file.name,manifest};
      }
      if(seq!==sequence.current)return;
      if(record){setPack(record);setProject(record.request.projectId);setBuyer(record.request.buyer);setFilesLabel(records[0].name);}
      if(imported)setArchive(imported);
      else if(record && pack)setArchive(null);
    }catch(e){if(seq===sequence.current){setError(e instanceof SyntaxError?"审核记录 JSON 格式无效。":displayError(e));setPack(null);setArchive(null);setFilesLabel("");}}
    finally{if(seq===sequence.current)setLoading(false);}
  }
  return <><div className="page-intro"><h1>凭证复验</h1></div><div className="columns"><div className="maincol"><section className="sheet">
    <div className="mode-switch" aria-label="复验方式">{[["files","审核文件"],["id","凭证编号"]].map(([key,label])=><button key={key} aria-pressed={mode===key} onClick={()=>setMode(key)}>{label}</button>)}</div>
    {mode==="files"?<><label className="dropzone" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();importFiles(e.dataTransfer.files);}}>
      <Icon name="upload" size={28}/><strong>选择或拖入审核文件</strong><small>审核记录 JSON，可同时选择发布包 ZIP</small>
      <input aria-label="选择审核文件" type="file" multiple accept=".json,.zip" onChange={e=>{importFiles(e.target.files);e.target.value="";}}/></label>
      <div className="actions">{state?.config?.sample && <button className="linkbutton" onClick={useSample}><Icon name="fingerprint" size={16}/>复验已成交示例</button>}</div>
      {filesLabel && <p className="subtle"><Icon name="file" size={16}/> {filesLabel}</p>}
      {archive && <p className="subtle">{archive.name} <button className="linkbutton" onClick={()=>setArchive(null)}>移除</button></p>}
      {archive && !pack && <p role="status">请再选择对应的审核记录 JSON。</p>}
      {pack && <div className="field-grid"><label>复验项目<input value={project} maxLength={128} onChange={e=>setProject(e.target.value)}/></label><label>复验买方<input value={buyer} onChange={e=>setBuyer(e.target.value)}/></label></div>}
      <Notice text={error || check.error}/>{check.error && <button onClick={check.retry}>重试</button>}
      {loading || check.pending?<p role="status">核验中…</p>:<Result value={check.result}/>}
      {check.result && <small className="subtle">{archive?"已比对发布包文件":"已核验申报清单"}</small>}
    </>:<form onSubmit={e=>{e.preventDefault();lookup.run(async()=>{setGrant(null);if(!validHash(id.trim()))throw Error("请输入完整的 32 字节凭证编号。");setGrant(await api("/api/grants/"+id.trim()));});}}>
      <label>链上凭证编号<input placeholder="0x…" value={id} disabled={lookup.busy} onChange={e=>{setId(e.target.value);setGrant(null);}}/></label>
      <div className="actions"><button className="primary" disabled={!id.trim() || lookup.busy}><Icon name="search"/>{lookup.busy?"查询中…":"查询凭证"}</button></div>
      <Notice text={lookup.error}/>{grant && <dl className="data">{[["买方",grant.buyer],["签发方",grant.issuer],["项目摘要",grant.projectHash],["组件版本",grant.version],["条款摘要",grant.termsHash],["成交金额（wei）",grant.priceWei],["区块",grant.blockNumber],["交易",grant.txHash]].map(([k,v])=><div key={k}><dt>{k}</dt><dd><code>{v}</code></dd></div>)}</dl>}
    </form>}</section></div><aside><section className="sheet"><div className="section-head"><h2>核验依据</h2><Icon name="shield"/></div><dl className="data"><div><dt>网络</dt><dd>{!state?"读取中…":state.config.chainId===10143?"Monad 测试网":"本地 EVM"}</dd></div><div><dt>合约</dt><dd><code title={state?.config?.contract}>{shorten(state?.config?.contract,6)}</code></dd></div><div><dt>源码版本</dt><dd><a href={catalog.sourceUrl} target="_blank" rel="noreferrer">{catalog.commit.slice(0,8)}</a></dd></div></dl></section></aside></div></>;
}
