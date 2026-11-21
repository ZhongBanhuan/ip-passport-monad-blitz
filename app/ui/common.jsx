"use client";

import { useState } from "react";
import { shorten, saveFile } from "./tools";
export function Book({
  small = false
}) {
  return <span className={small ? "book small" : "book"} aria-hidden="true"><i /><b /></span>;
}
export function Result({
  value
}) {
  if (!value) return null;
  const name = {
    ready: "可发布",
    blocked: "缺少材料或授权",
    review: "需人工复核"
  }[value.decision] || "待确认";
  return <section className={"result " + (value.decision === "ready" ? "success" : "")} aria-live="polite"><h3>{name}</h3>{value.items?.map((x, i) => <p key={i}><strong>{{
          core: "Markdown 转换器",
          templates: "专业报告模板"
        }[x.id] || x.id}</strong>　{typeof x.reason === "string" ? x.reason : JSON.stringify(x.reason)}</p>)}{value.issues?.filter(x => !value.items?.some(item => item.reason === x)).map((x, i) => <p key={i}>{typeof x === "string" ? x : x.reason || x.message || JSON.stringify(x)}</p>)}<small>发布包指纹 <code title={value.packageHash}>{shorten(value.packageHash, 10)}</code>　规则 {value.ruleVersion}</small></section>;
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
