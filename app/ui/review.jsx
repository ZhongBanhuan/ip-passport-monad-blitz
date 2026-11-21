"use client";
import {sitePath,requestApi} from "./transport";

import { useEffect, useState, useRef } from "react";
import { buildManifest, catalog } from "../../lib/rules.mjs";
import { buyOffer, grantId } from "../../lib/chain.mjs";
import { Result, TextPanel, Notice, useJob } from "./common";
import { api, shorten, saveFile, ZERO_ADDRESS } from "./tools";
function Cover() {
  return <div className="cover-art" aria-hidden="true"><div className="cover-shadow" /><div className="passport-cover"><span>知识产权护照</span><div className="globe">{Array.from({
          length: 12
        }, (_, i) => <i key={i} style={{
          transform: "rotate(" + i * 15 + "deg)"
        }} />)}</div><small>IP PASSPORT</small></div></div>;
}
export default function Review({
  state,
  wallet,
  connect
}) {
  const [project, setProject] = useState("weekly-report"),
    [templates, setTemplates] = useState(true),
    [notice, setNotice] = useState(false),
    [accepted, setAccepted] = useState(false);
  const [checked, setChecked] = useState(null),
    [receipt, setReceipt] = useState(null),
    [terms, setTerms] = useState(false),
    [published, setPublished] = useState(null);
  const [sample, setSample] = useState(null);
  const job = useJob(),
    panel = useRef(null);
  useEffect(() => {
    setChecked(null);
    setPublished(null);
    setReceipt(null);
    setAccepted(false);
  }, [project, templates, notice, wallet, state?.offerId, sample]);
  const config = state?.config,
    available = Boolean(config?.contract && state?.offer?.active && state.offerId && !state?.chainError);
  const currency = config?.chainId && Number(config.chainId) !== 10143 ? "本地 ETH" : "MON";
  function draft(buyer = sample?.buyer || wallet, grant = null) {
    if (!project.trim()) throw new Error("请先填写项目标识。");
    const id = templates ? grant?.id || sample?.grantId || (buyer && config?.contract && state?.offerId ? grantId(state.offerId, buyer, project.trim()) : undefined) : undefined;
    return {
      projectId: project.trim(),
      buyer: buyer || ZERO_ADDRESS,
      purpose: catalog.purpose,
      ...buildManifest(templates, notice),
      ...(id ? {
        grantId: id
      } : {})
    };
  }
  async function check(buyer = sample?.buyer || wallet, grant = null) {
    const request = draft(buyer, grant),
      result = await api("/api/check", request);
    setChecked({
      request,
      result
    });
    return {
      request,
      result
    };
  }
  async function purchase() {
    if (sample) throw new Error("请先退出示例买方，再使用自己的钱包购买。");
    if (!accepted) throw new Error("请先阅读并同意本次授权条款。");
    if (!available) throw new Error("此报价尚未就绪，请在作者登记页检查网络与报价。");
    const buyer = await connect();
    const g = await buyOffer(config, {
      offerId: state.offerId,
      projectId: project.trim(),
      buyer,
      provider: window.ethereum
    });
    setReceipt(g);
    await check(buyer, g);
  }
  async function publish() {
    const response = await check();
    if (response.result.decision !== "ready") throw new Error("最新审核尚有待办，请按逐项意见补齐。");
    const pack = {
      format: "ip-passport-review/1",
      ...response,
      catalogCommit: catalog.commit, sourceUrl: catalog.sourceUrl,
      mitText: catalog.mitText,
      termsText: catalog.termsText,
      rightsText: catalog.rightsText,
      grant: response.result.grant || receipt,
      chainId: config?.chainId,
      contract: config?.contract,
      reviewedAt: new Date().toISOString()
    };
    setPublished(pack);
    saveFile("发布审核-" + project.trim() + ".json", pack);
  }
  async function downloadPackage() {
    const response = await requestApi("/api/package", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(draft())
    });
    if (!response.ok) {
      const e = await response.json();
      throw new Error(e.error || "发布包尚未通过核验。");
    }
    const url = URL.createObjectURL(await response.blob()),
      link = document.createElement("a");
    link.href = url;
    link.download = project.trim() + ".zip";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  const rows = checked?.result.items || [];
  const confirmed = checked?.result.grant || receipt;
  function status(id, initial) {
    return rows.find(x => x.id === id)?.reason || initial;
  }
  return <><section className="hero"><div><div className="small-line"><span className="signal" />发布审核</div><h1>周报生成 Skill</h1><p>逐项核对发布包里的代码与模板，确认本次商业分发所需的许可。</p></div><Cover /></section>
 <div className="columns"><div className="maincol"><section className="sheet"><div className="section-head"><h2>发布清单</h2><span className="muted">{templates ? "2" : "1"} 个组件</span></div>
 <div className="field-grid"><label>Skill 项目标识<input value={project} maxLength={100} disabled={job.busy} onChange={e => setProject(e.target.value)} required /></label><div><label>拟议用途</label><div className="field-read">随收费 Skill 分发</div></div></div>
 {state?.config?.sample && <div className="sample-actions">{sample ? <><span>示例买方　<code>{shorten(sample.buyer, 6)}</code></span><button onClick={() => setSample(null)}>退出示例买方</button></> : <button onClick={() => {
              setSample(config.sample);
              setProject(config.sample.projectId);
              setNotice(true);
              setTemplates(true);
            }}>载入已购买的示例项目</button>}</div>}
 <div className="component"><div className="comp-title"><div className="glyph" aria-hidden="true">⌘</div><div><h3>Markdown 转换器</h3><code>core/</code></div><span className="chip green">MIT</span></div><p>{status("core", "允许商业分发。发布包应附版权和许可声明。")}</p>
 <label className="check"><input type="checkbox" disabled={job.busy} checked={notice} onChange={e => setNotice(e.target.checked)} />在发布清单中附上 MIT 声明</label>
 <TextPanel title="查看或下载 MIT 许可原文" text={catalog.mitText} name="LICENSE-MIT.txt" /></div>
 <div className="component"><div className="comp-title"><div className="glyph sheets" aria-hidden="true">▤</div><div><h3>专业报告模板</h3><code>templates/</code></div><span className="chip violet">独立授权</span></div>
 <p>{templates ? status("templates", "12 套报告模板。随收费 Skill 分发时，须取得此版本的项目授权。") : "已从本次发布包移除。"}</p>
 <label className="check"><input type="checkbox" disabled={job.busy} checked={templates} onChange={e => setTemplates(e.target.checked)} />将模板加入发布包</label>
 <details className="textpanel"><summary>查看组件文件和版本</summary><small>版本</small><code>{catalog.components.templates.version}</code><ul>{catalog.components.templates.files.map(f => <li key={f.path}>{f.path}</li>)}</ul></details></div>
 <small className="source">示例仓库快照　<a href={catalog.sourceUrl} target="_blank" rel="noreferrer"><code title={catalog.commit}>{shorten(catalog.commit, 8)}</code></a></small></section>
 <section ref={panel} className="sheet"><div className="section-head"><h2>上架决定</h2></div>
 <p className="muted">检查当前清单与可用凭证，按逐项意见补齐发布材料。</p><div className="actions"><button className="primary" disabled={job.busy} onClick={() => job.run(() => check())}>{job.busy ? "处理中…" : "检查上架条件"}</button>
 {checked?.result.decision === "ready" && <button disabled={job.busy} onClick={() => job.run(publish)}>确认发布并导出记录</button>}
 {checked?.result.decision === "ready" && <button disabled={job.busy} onClick={() => job.run(downloadPackage)}>下载已核验发布包</button>}
 {checked && <button disabled={job.busy} onClick={() => saveFile("审核记录.json", {
              format: "ip-passport-review/1",
              ...checked,
              catalogCommit: catalog.commit, sourceUrl: catalog.sourceUrl,
              mitText: catalog.mitText,
              termsText: catalog.termsText,
              rightsText: catalog.rightsText,
              grant: confirmed
            })}>导出核验包</button>}</div>
 <Result value={checked?.result} />{published && <p className="success-text">发布审核已通过，记录已导出。</p>}<Notice text={job.error} /></section></div>
 <aside><section className="quotation"><span className="small-line">本次商业授权</span><h2>单项目分发许可</h2><div className="price">{templates ? "0.1" : "0"} <small>{currency}</small></div><dl><div><dt>授权对象</dt><dd>{templates ? "专业报告模板" : "仅 MIT 组件"}</dd></div><div><dt>适用项目</dt><dd>{project || "待填写"}</dd></div><div><dt>许可期限</dt><dd>永久</dd></div></dl>
 {templates ? <><button className="ink full" onClick={() => setTerms(!terms)}>{terms ? "收起授权条款" : "查看条款与购买"}</button>{terms && <div className="terms"><TextPanel title="阅读或下载授权全文" text={catalog.termsText} name="COMMERCIAL-LICENSE.txt" /><label className="check"><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />我已阅读并接受本次条款</label>
 <button className="primary full" disabled={job.busy || !!sample || !accepted || !available || !project.trim()} onClick={() => job.run(purchase)}>支付 0.1 {currency} 并领取凭证</button>{!available && <p className="muted">签发方尚未提供可核验的链上报价。<a href={sitePath("/author")}>查看登记状态</a></p>}</div>}</> : <p>基础版仅需附上 MIT 声明。</p>}
 {confirmed && <div className="confirmed"><h3>链上成交记录</h3><dl>
 <div><dt>作者收款</dt><dd>0.1 {currency}</dd></div>
 <div><dt>收款方</dt><dd title={confirmed.recipient}><code>{shorten(confirmed.recipient,6)}</code></dd></div>
 <div><dt>凭证编号</dt><dd title={confirmed.id}><code>{shorten(confirmed.id,6)}</code></dd></div>
 <div><dt>交易</dt><dd title={confirmed.txHash}>{config?.explorerUrl?<a href={config.explorerUrl+"/tx/"+confirmed.txHash} target="_blank" rel="noreferrer"><code>{shorten(confirmed.txHash,6)}</code></a>:<code>{shorten(confirmed.txHash,6)}</code>}</dd></div>
 <div><dt>实际 gas 用量</dt><dd>{String(confirmed.gasUsed)}</dd></div>
 {receipt?.elapsedMs>0&&<div><dt>本次确认耗时</dt><dd>{receipt.elapsedMs} ms</dd></div>}
 </dl></div>}</section>
 <section className="side-note"><h3>授权如何复验？</h3><p>导出本次核验包后，可检查买方、项目、版本与链上凭证是否一致。</p><a href={sitePath("/verify")}>打开凭证复验</a></section></aside></div></>;
}
