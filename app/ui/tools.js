import {requestApi} from "./transport";
export function shorten(s, length = 8) {
  return s && s.length > length * 2 + 1 ? s.slice(0, length) + "…" + s.slice(-length) : s || "—";
}
export function saveFile(name, contents, type = "application/json") {
  const data = typeof contents === "string" ? contents : JSON.stringify(contents, null, 2);
  const url = URL.createObjectURL(new Blob([data], {
    type
  }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}
export async function api(path, body) {
  const res = await requestApi(path, body === undefined ? {
    cache: "no-store"
  } : {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body),
    cache: "no-store"
  });
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("服务响应异常，请检查服务地址后重试。");
  }
  if (!res.ok || data.error) throw new Error(typeof data.error === "string" ? data.error : "查询未完成，请稍后重试。");
  return data;
}
export function displayError(e) {
  return e?.code === 4001 || e?.cause?.code === 4001 ? "钱包已取消交易。" : e?.shortMessage || e?.message || "操作未完成，请重试。";
}
export const validHash = s => /^0x[0-9a-f]{64}$/i.test(s || "");
export async function commitment(file, saltHex) {
  if (!validHash(saltHex)) throw new Error("证据包中的随机盐格式有误。");
  const salt = Uint8Array.from(saltHex.slice(2).match(/../g), s => parseInt(s, 16));
  const bytes = new Uint8Array(await file.arrayBuffer());
  const data = new Uint8Array(salt.length + bytes.length);
  data.set(salt);
  data.set(bytes, salt.length);
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", data)));
}
export function hex(bytes) {
  return "0x" + Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
export const ZERO32 = "0x" + "0".repeat(64);
export const ZERO_ADDRESS = "0x" + "0".repeat(40);
