"use client";
import {sitePath} from "./transport";

import { useEffect, useState } from "react";
import { Book, Notice } from "./common";
import { api, shorten, displayError } from "./tools";
import Review from "./review";
import Author from "./author";
import Verify from "./verify";
const tabs = [["check", "/", "上架审核"], ["author", "/author", "作者登记"], ["verify", "/verify", "凭证复验"]];
export default function Workspace({
  view
}) {
  const [state, setState] = useState(null),
    [err, setErr] = useState(""),
    [wallet, setWallet] = useState("");
  async function refresh() {
    try {
      setState(await api("/api/config"));
      setErr("");
    } catch (e) {
      setErr(displayError(e));
    }
  }
  async function connect() {
    const provider = window.ethereum;
    if (!provider) throw new Error("请在支持 EVM 钱包的浏览器中打开。免费核验无需连接钱包。");
    const cfg = state?.config;
    if (cfg?.contract) {
      const expected = "0x" + Number(cfg.chainId).toString(16);
      if ((await provider.request({
        method: "eth_chainId"
      })).toLowerCase() !== expected) {
        try {
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{
              chainId: expected
            }]
          });
        } catch (e) {
          if (e.code !== 4902) throw e;
          const testnet = Number(cfg.chainId) === 10143;
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [{
              chainId: expected,
              chainName: testnet ? "Monad Testnet" : "IP Passport Local EVM",
              nativeCurrency: {
                symbol: testnet ? "MON" : "ETH",
                name: testnet ? "Test MON" : "Local ETH",
                decimals: 18
              },
              rpcUrls: [cfg.rpcUrl],
              ...(cfg.explorerUrl ? {
                blockExplorerUrls: [cfg.explorerUrl]
              } : {})
            }]
          });
        }
      }
    }
    const [addr] = await provider.request({
      method: "eth_requestAccounts"
    });
    if (!addr) throw new Error("钱包尚未授权账户。");
    setWallet(addr);
    return addr;
  }
  useEffect(() => {
    refresh();
    const provider = window.ethereum;
    if (!provider) return;
    let alive = true;
    const change = accounts => {
      if (alive) setWallet(accounts?.[0] || "");
    };
    provider.request({
      method: "eth_accounts"
    }).then(change).catch(() => {});
    provider.on?.("accountsChanged", change);
    return () => {
      alive = false;
      provider.removeListener?.("accountsChanged", change);
    };
  }, []);
  const local = state?.config?.chainId && Number(state.config.chainId) !== 10143;
  return <><header className="top"><div className="top-inner"><a className="brand" href={sitePath("/")}><Book small /><span>知识产权护照</span></a>
 <nav aria-label="工作台">{tabs.map(([key, url, label]) => <a key={key} href={sitePath(url)} aria-current={key === view ? "page" : undefined}>{label}</a>)}</nav>
 <button className="wallet" onClick={() => connect().then(() => setErr("")).catch(e => setErr(displayError(e)))}>{wallet ? shorten(wallet, 5) : "连接钱包"}</button></div></header>
 <main><div className="crumb"><span>工作台　/　{tabs.find(t => t[0] === view)[2]}</span><span className="network">{local ? "本地 EVM" : "Monad 测试网"}</span></div>
 <Notice text={err} />{err && !state && <button onClick={refresh}>重新连接服务</button>}
 {view === "check" ? <Review state={state} wallet={wallet} connect={connect} /> : view === "author" ? <Author state={state} wallet={wallet} connect={connect} refresh={refresh} /> : <Verify state={state} />}
 </main><footer><div>知识产权护照</div><span>{process.env.NEXT_PUBLIC_PAGES_BASE ? "公开演示 · 审核记录保存在此浏览器" : "AI Skill 许可审核工作台"}</span></footer></>;
}
