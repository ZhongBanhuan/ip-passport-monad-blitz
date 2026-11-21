"use client";

import {Icon} from "./identity";
import { useState } from "react";
import { keccak256, toBytes } from "viem";
import { catalog } from "../../lib/rules.mjs";
import { publishOffer, registerVersion } from "../../lib/chain.mjs";
import { TextPanel, Notice, useJob } from "./common";
import { shorten, saveFile, commitment, hex, ZERO32, validHash } from "./tools";
export default function Author({
  state,
  connect,
  refresh
}) {
  const [mode,setMode]=useState("fingerprint");
  const [file, setFile] = useState(null),
    [backup, setBackup] = useState(null),
    [parent, setParent] = useState(""),
    [work, setWork] = useState("private-journal"),
    [message, setMessage] = useState(""),
    [proof, setProof] = useState(null),
    [original, setOriginal] = useState(null),
    [proofFile, setProofFile] = useState(null);
  const pub = useJob(),
    local = useJob(),
    verify = useJob(),
    [matched, setMatched] = useState(null);
  const cfg = state?.config,
    enabled = !!(cfg?.contract && cfg?.issuer);
  const currency = cfg?.chainId && Number(cfg.chainId) !== 10143 ? "本地 ETH" : "MON";
  async function ensureIssuer() {
    const account = await connect();
    if (!enabled || account.toLowerCase() !== cfg.issuer.toLowerCase()) throw new Error("请使用本平台已核对的签发钱包进行登记。");
  }
  async function createOffer() {
    await ensureIssuer();
    const tx = await publishOffer(cfg, {
      workId: state.workId,
      version: catalog.components.templates.version,
      parent: ZERO32,
      termsHash: catalog.termsHash,
      priceWei: catalog.priceWei,
      recipient: cfg.recipient || cfg.issuer,
      provider: window.ethereum
    });
    setMessage("报价已登记 · " + tx.txHash);
    await refresh();
  }
  async function createLocal() {
    if (!file || !work.trim()) throw new Error("请填写作品标识并选择原稿。");
    if (parent && !validHash(parent)) throw new Error("父版本须为带 0x 前缀的 32 字节指纹。");
    const salt = hex(crypto.getRandomValues(new Uint8Array(32))),
      version = await commitment(file, salt);
    const p = {
      format: "ip-passport-private/1",
      algorithm: "SHA-256(salt32 || file)",
      workId: keccak256(toBytes(work.trim())),
      parent: parent || ZERO32,
      version,
      salt,
      fileName: file.name
    };
    setBackup(p);
    setProof(null);
    saveFile("私有版本证据包.json", p);
  }
  async function register() {
    await ensureIssuer();
    const tx = await registerVersion(cfg, {
      workId: backup.workId,
      version: backup.version,
      parent: backup.parent,
      provider: window.ethereum
    });
    const p = {
      ...backup,
      chainId: cfg.chainId,
      contract: cfg.contract,
      txHash: tx.txHash,
      blockNumber: String(tx.blockNumber)
    };
    setProof(p);
    saveFile("已登记的私有版本.json", p);
  }
  async function verifyLocal() {
    if (!original || !proofFile) throw new Error("请选择原文件和本地证据包。");
    const p = JSON.parse(await proofFile.text());
    if (p.format !== "ip-passport-private/1" || !validHash(p.version)) throw new Error("请选择从作者登记页导出的私有版本证据包。");
    setMatched((await commitment(original, p.salt)) === p.version);
  }
  return <><div className="page-intro"><h1>作者登记</h1></div><div className="columns"><div className="maincol"><section className="sheet">
    <div className="mode-switch" aria-label="登记方式">{[["fingerprint","登记原稿"],["compare","核对原件"],["offer","素材报价"]].map(([id,label])=><button key={id} aria-pressed={mode===id} onClick={()=>setMode(id)}>{label}</button>)}</div>
    {mode==="fingerprint" && <><label className="dropzone"><Icon name="fingerprint" size={28}/><strong>{file?.name || "选择本地原稿"}</strong><small>原文留在此设备</small><input type="file" aria-label="选择本地原稿" onChange={e=>{setFile(e.target.files[0]);setBackup(null);setProof(null);}}/></label>
      <label>作品标识<input value={work} onChange={e=>{setWork(e.target.value);setBackup(null);setProof(null);}}/></label>
      <details className="details"><summary>关联父版本（可选）</summary><label>父版本指纹<input value={parent} placeholder="0x…" onChange={e=>{setParent(e.target.value);setBackup(null);setProof(null);}}/></label></details>
      <div className="actions"><button className="primary" disabled={!file || !work.trim() || local.busy} onClick={()=>local.run(createLocal)}><Icon name="download"/>生成并保存证据包</button>
      {backup && <button disabled={!enabled || local.busy || !!proof} onClick={()=>local.run(register)}>{proof?"已登记":"用签发钱包登记上链"}</button>}</div>
      <Notice text={local.error}/>{backup && <details className="details"><summary>版本指纹</summary><code>{backup.version}</code>{proof && <p>交易 <code>{proof.txHash}</code></p>}</details>}</>}
    {mode==="compare" && <><label>待核对原件<input type="file" onChange={e=>{setOriginal(e.target.files[0]);setMatched(null);}}/></label>
      <label>私有版本证据包<input type="file" accept=".json" onChange={e=>{setProofFile(e.target.files[0]);setMatched(null);}}/></label>
      <div className="actions"><button className="primary" disabled={!original || !proofFile || verify.busy} onClick={()=>verify.run(verifyLocal)}><Icon name="search"/>比对指纹</button></div>
      <Notice text={verify.error}/>{matched!==null && <p className={"status-mark "+(matched?"ok":"warn")} role="status">{matched?"原件指纹一致":"文件与证据包不匹配"}</p>}</>}
    {mode==="offer" && <><h2>专业报告模板</h2><p>12 套模板 · 单项目商业分发</p><TextPanel title="权利来源声明" text={catalog.rightsText} name="RIGHTS.txt"/>
      <TextPanel title="单项目商业许可" text={catalog.termsText} name="COMMERCIAL-LICENSE.txt"/>
      <details className="details"><summary>版本与签发信息</summary><dl className="data">{[["版本指纹",catalog.components.templates.version],["条款摘要",catalog.termsHash],["签发钱包",cfg?.issuer || "待配置"]].map(([label,value])=><div key={label}><dt>{label}</dt><dd><code>{value}</code></dd></div>)}<div><dt>固定 commit</dt><dd><a href={catalog.sourceUrl}>{catalog.commit.slice(0,8)}</a></dd></div></dl></details>
      <div className="actions"><button className="primary" disabled={pub.busy || !enabled || !!state?.offer} onClick={()=>pub.run(createOffer)}>{state?.offer?"报价已登记":"登记 0.1 "+currency+" 报价"}</button></div><Notice text={pub.error}/>{message && <p role="status">{message}</p>}</>}
    </section></div><aside><section className="sheet"><div className="section-head"><h2>{mode==="offer"?"授权摘要":"证据包"}</h2><Icon name={mode==="offer"?"key":"file"}/></div>
      {mode==="offer"?<dl className="data"><div><dt>价格</dt><dd>0.1 {currency}</dd></div><div><dt>期限</dt><dd>永久</dd></div><div><dt>收款地址</dt><dd title={cfg?.recipient}>{shorten(cfg?.recipient,5)}</dd></div></dl>:<><dl className="data"><div><dt>算法</dt><dd>SHA-256</dd></div><div><dt>保存位置</dt><dd>本地</dd></div></dl><p className="subtle">请保留原稿和含随机盐的证据包，以便日后核对。</p></>}</section></aside></div></>;
}
