"use client";

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
  return <><div className="page-intro"><h1>作者登记</h1><p>发布可分发的素材报价，或为本地原稿登记带盐版本指纹。</p></div><div className="columns"><div className="maincol"><section className="sheet"><h2>专业报告模板</h2><p>12 套模板的单项目商业分发许可。买方可以在指定 Skill 中嵌入本版本，独立转售模板包须另行取得授权。</p><dl className="data"><div><dt>版本指纹</dt><dd><code>{catalog.components.templates.version}</code></dd></div><div><dt>固定 commit</dt><dd><a href={catalog.sourceUrl} target="_blank" rel="noreferrer"><code>{catalog.commit}</code></a></dd></div><div><dt>条款摘要</dt><dd><code>{catalog.termsHash}</code></dd></div></dl>
 <TextPanel title="权利来源声明" text={catalog.rightsText} name="RIGHTS.txt" /><TextPanel title="单项目商业许可全文" text={catalog.termsText} name="COMMERCIAL-LICENSE.txt" />
 <p className="muted">签发钱包　<code>{cfg?.issuer || "尚未配置"}</code></p><button className="primary" disabled={pub.busy || !enabled || !!state?.offer} onClick={() => pub.run(createOffer)}>{state?.offer ? "报价已登记" : "登记 0.1 " + currency + " 报价"}</button><Notice text={pub.error} />{message && <p role="status">{message}</p>}</section>
 <section className="sheet"><h2>本地原稿指纹</h2><p>选择一个原稿或对话导出文件。浏览器生成随机盐与指纹，并下载含盐的证据包，原文保留在此设备。</p>
 <label>作品标识<input value={work} onChange={e => {
              setWork(e.target.value);
              setBackup(null);
              setProof(null);
            }} /></label><label>父版本指纹（首次可留空）<input value={parent} placeholder="0x…" onChange={e => {
              setParent(e.target.value);
              setBackup(null);
              setProof(null);
            }} /></label><label>原稿文件<input type="file" onChange={e => {
              setFile(e.target.files[0]);
              setBackup(null);
              setProof(null);
            }} /></label>
 <div className="actions"><button disabled={!file || local.busy} onClick={() => local.run(createLocal)}>生成指纹并下载证据包</button>{backup && <button disabled={!enabled || local.busy || !!proof} onClick={() => local.run(register)}>登记版本指纹上链</button>}</div><Notice text={local.error} />{backup && <p>本地指纹 <code>{backup.version}</code></p>}{proof && <p>已登记交易 <code>{proof.txHash}</code></p>}</section>
 <section className="sheet"><h2>本地原件核对</h2><label>待验证原件<input type="file" onChange={e => {
              setOriginal(e.target.files[0]);
              setMatched(null);
            }} /></label><label>私有版本证据包<input type="file" accept=".json,application/json" onChange={e => {
              setProofFile(e.target.files[0]);
              setMatched(null);
            }} /></label><button disabled={verify.busy} onClick={() => verify.run(verifyLocal)}>重算并比对指纹</button><Notice text={verify.error} />{matched !== null && <p role="status">{matched ? "一致，文件与证据包内指纹匹配。" : "不一致，文件内容或证据包已变化。"}</p>}</section></div>
 <aside><section className="quotation"><div className="small-line">固定版本报价</div><h2>专业报告模板</h2><div className="price">0.1 <small>{currency}</small></div><dl><div><dt>报价状态</dt><dd>{state?.offer ? "链上已登记" : enabled ? "待签发" : "待配置合约"}</dd></div><div><dt>适用目录</dt><dd><code>templates/</code></dd></div><div><dt>收款地址</dt><dd title={cfg?.recipient || cfg?.issuer}>{shorten(cfg?.recipient || cfg?.issuer, 5)}</dd></div></dl></section></aside></div></>;
}
