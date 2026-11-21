"use client";
import {useEffect, useState} from "react";
import {api, displayError} from "./tools";

// Tie each decision to its exact inputs; late RPC responses cannot unlock a newer draft.
export function useCheck(request, expectedHash = null) {
  const key = request ? JSON.stringify([request, expectedHash]) : "";
  const [response, setResponse] = useState(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!key) return;
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const [body, hash] = JSON.parse(key);
        let result = await api("/api/check", body);
        if (hash && hash !== result.packageHash) {
          result = {...result, decision:"review", issues:[...result.issues,"发布包与审核记录的指纹不一致。"]};
        }
        if (active) setResponse({key, attempt, result});
      } catch (error) {
        if (active) setResponse({key, attempt, error:displayError(error)});
      }
    }, 300);
    return () => {active=false; clearTimeout(timer);};
  }, [key,attempt]);
  const current = response?.key===key && response.attempt===attempt ? response : null;
  return {result:current?.result, error:current?.error, pending:!!key && !current, retry:()=>setAttempt(n=>n+1)};
}
