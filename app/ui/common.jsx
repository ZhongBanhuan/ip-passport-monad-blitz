"use client";

import { useState } from "react";
import { shorten, saveFile } from "./tools";
export function Result({value}) {
  if(!value)return null;
  const ready=value.decision==="ready";
  const title=ready?"可发布":value.decision==="review"?"需人工复核":"缺少材料或授权";
  return <section className={"result "+(ready?"success":"")} aria-live="polite"><h3>{title}</h3>
    {!ready && value.issues?.map((reason,i)=><p key={i}>{reason}</p>)}
    <details className="details"><summary>逐项依据与指纹</summary>
      {value.items?.map((item,i)=><p key={i}><strong>{{core:"Markdown 转换器",templates:"专业报告模板"}[item.id] || item.id}</strong>　{item.reason}</p>)}
      <small>发布包指纹 <code>{value.packageHash}</code></small></details>
  </section>;
}
export function TextPanel({
  title,
  text,
  name
}) {
  return <details className="textpanel"><summary>{title}</summary><pre>{text || "原文尚未载入"}</pre>{text && <button type="button" onClick={() => saveFile(name, text, "text/plain;charset=utf-8")}>下载原文</button>}</details>;
}
export function useJob() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function run(action) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e.shortMessage || e.message || "操作失败");
    } finally {
      setBusy(false);
    }
  }
  return {
    busy,
    error,
    run
  };
}
export function Notice({
  text
}) {
  return text ? <p role="alert" className="notice">{text}</p> : null;
}
