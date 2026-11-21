"use client";
import {requestApi} from "./transport";

import { useState } from "react";
import { catalog, buildManifest } from "../../lib/rules.mjs";
import { api, shorten, validHash } from "./tools";
import { Result, Notice, useJob } from "./common";
export default function Verify({
  state
}) {
  const [id, setId] = useState(""),
    [grant, setGrant] = useState(null),
    [pack, setPack] = useState(null),
    [project, setProject] = useState(""),
    [buyer, setBuyer] = useState(""),
    [result, setResult] = useState(null);
  const lookup = useJob(),
    audit = useJob();
  const [zip, setZip] = useState(null);
  async function loadSample() {
    const sample = state.config.sample;
    const request = {
      projectId: sample.projectId,
      buyer: sample.buyer,
      purpose: catalog.purpose,
      ...buildManifest(true, true),
      grantId: sample.grantId
    };
    setResult(null);
    setZip(null);
    setProject(request.projectId);
    setBuyer(request.buyer);
    setId(sample.grantId);
    setGrant(null);
    const original = await api("/api/check", request);
    setResult(original);
    setPack({
      request,
      result: original,
      catalogCommit: catalog.commit,
      mitText: catalog.mitText,
      termsText: catalog.termsText,
      rightsText: catalog.rightsText
    });
    setGrant(await api("/api/grants/" + sample.grantId));
  }
  async function inspectZip(file) {
    const response = await requestApi("/api/inspect", {
      method: "POST",
      headers: {
        "Content-Type": "application/zip"
      },
      body: file
    });
    const responseBody = await response.json();
    if (!response.ok) throw new Error(responseBody.error || "无法读取发布包。");
    return responseBody;
  }
  async function load(f) {
    setPack(null);
    setResult(null);
    if (!f) return;
    const p = JSON.parse(await f.text());
    if (p.format !== "ip-passport-review/1" || !p.request) throw new Error("请选择从上架审核页导出的核验包。");
    setPack(p);
    setProject(p.request.projectId);
    setBuyer(p.request.buyer);
    setId(p.request.grantId || "");
    setGrant(null);
  }
  async function verify() {
    if (!pack) throw new Error("请先导入核验包。");
    if (pack.catalogCommit !== catalog.commit || pack.mitText !== catalog.mitText || pack.termsText !== catalog.termsText || pack.rightsText !== catalog.rightsText) throw new Error("材料原文或来源版本与本次支持的快照不符，需人工复核。");
    const bytes = zip ? await inspectZip(zip) : {};
    const r = await api("/api/check", {
      ...pack.request,
      ...bytes,
      projectId: project,
      buyer
    });
    if (zip && pack.result?.packageHash !== r.packageHash) {
      setResult({
        ...r,
        decision: "review",
        issues: [...(r.issues || []), "实际发布包与导出的审核记录指纹不同。"]
      });
      return;
    }
    setResult(r);
  }
  return <><div className="page-intro"><h1>凭证复验</h1><p>按链上凭证查询交易，或导入发布清单，重新核验项目与组件范围。</p></div><div className="columns"><div className="maincol">
 <section className="sheet"><h2>复核发布决定</h2><label>审核记录 JSON<input type="file" accept=".json,application/json" onChange={e => audit.run(() => load(e.target.files[0]))} /></label>{pack && <><div className="field-grid"><label>复验项目<input value={project} onChange={e => {
                  setResult(null);
                  setProject(e.target.value);
                }} /></label><label>复验买方<input value={buyer} onChange={e => {
                  setResult(null);
                  setBuyer(e.target.value);
                }} /></label></div><p className="muted">改用其他项目或买方，可检查凭证的适用范围。</p></>}
 {state?.config?.sample && <div className="sample-actions"><button disabled={audit.busy} onClick={() => audit.run(loadSample)}>使用已成交的示例凭证</button></div>}
 <label>实际发布包 ZIP（可选）<input type="file" accept=".zip,application/zip" onChange={e => {
              setResult(null);
              setZip(e.target.files[0]);
            }} /></label>
 <p className="muted">{zip ? "将按所选发布包中的实际文件重新计算指纹。" : "仅导入 JSON 时按已申报的清单复核。"}</p><button className="primary" disabled={!pack || audit.busy} onClick={() => audit.run(verify)}>重新核验</button><Notice text={audit.error} /><Result value={result} /></section>
 <section className="sheet"><h2>查询链上凭证</h2><label>凭证 ID<input placeholder="0x…" value={id} onChange={e => {
              setId(e.target.value);
              setGrant(null);
            }} /></label><button disabled={lookup.busy} onClick={() => lookup.run(async () => {
            if (!validHash(id.trim())) throw new Error("凭证 ID 应为 32 字节十六进制值。");
            setGrant(await api("/api/grants/" + id.trim()));
          })}>查询凭证</button><Notice text={lookup.error} />
 {grant && <dl className="data">{[["买方", grant.buyer], ["签发方", grant.issuer], ["项目摘要", grant.projectHash], ["组件版本", grant.version], ["条款摘要", grant.termsHash], ["成交金额（wei）", grant.priceWei], ["区块", grant.blockNumber], ["交易", grant.txHash]].map(([k, v]) => <div key={k}><dt>{k}</dt><dd><code>{String(v ?? "—")}</code></dd></div>)}</dl>}</section></div>
 <aside><section className="quotation"><h2>核验依据</h2><dl><div><dt>网络</dt><dd>{Number(state?.config?.chainId) === 10143 ? "Monad 测试网" : state?.config?.chainId || "待载入"}</dd></div><div><dt>合约地址</dt><dd title={state?.config?.contract}>{shorten(state?.config?.contract, 6)}</dd></div><div><dt>来源版本</dt><dd title={catalog.commit}>{shorten(catalog.commit, 6)}</dd></div></dl><p>复验会重新读取当前材料与链上记录。旧核验包中的审核结论仅供对照。</p></section></aside></div></>;
}
