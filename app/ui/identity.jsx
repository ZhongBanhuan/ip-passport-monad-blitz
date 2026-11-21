const strokes = {
  book: <><path d="M6 3h11.5A2.5 2.5 0 0 1 20 5.5V20H7a3 3 0 0 1-3-3V5a2 2 0 0 1 2-2Z"/><path d="M4 17a2 2 0 0 1 2-2h14M8 3v12"/><circle cx="14" cy="9" r="2.5"/></>,
  check: <path d="m5 12 4.4 4.4L19.5 6.8"/>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/></>,
  code: <><path d="m7.5 7-5 5 5 5m9-10 5 5-5 5m-3-13-3 16"/></>,
  file: <><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6"/></>,
  shield: <><path d="M12 2.8c2.8 2 5.4 2.9 8 3.2v6c0 4.2-3.3 7.8-8 9.2-4.7-1.4-8-5-8-9.2V6c2.6-.3 5.2-1.2 8-3.2Z"/><path d="m8.4 12 2.3 2.4 4.9-5"/></>,
  download: <><path d="M12 3v11m-4-4 4 4 4-4M4 15v5h16v-5"/></>,
  wallet: <><path d="M4 7.6V6a2 2 0 0 1 1.6-2L16 2.8V7M4 7h15a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H5a2 2 0 0 1-2-2V8.5A1.5 1.5 0 0 1 4.5 7Z"/><path d="M20 11h-4a2 2 0 0 0 0 4h4"/><circle cx="16.3" cy="13" r=".5"/></>,
  fingerprint: <><path d="M4.5 9a7.8 7.8 0 0 1 15 3M3.8 14v-1.5m2.8 5.2c.8-1.5 1.1-3.6 1.1-5.6a4.3 4.3 0 1 1 8.6 0c0 2.5-.4 4.9-1.4 7.8M10 21a19.6 19.6 0 0 0 2-8.8m6.6 5.8.4-2.4"/></>,
  search: <><circle cx="10.2" cy="10.2" r="6.5"/><path d="m15.1 15.1 5 5"/></>,
  chevron: <path d="m8 10 4 4 4-4"/>,
  globe: <><circle cx="12" cy="12" r="8.5"/><ellipse cx="12" cy="12" rx="3.6" ry="8.5"/><path d="M3.7 10h16.6M4.5 15h15"/></>,
  key: <><circle cx="8" cy="9" r="4.6"/><path d="m11.5 12.5 7.4 7.4m-1.8-1.8 2.5-2.5m-5.2-.2 2.5-2.5"/></>,
  external: <><path d="M13 4h7v7m0-7L10 14M10 6H5v13h13v-5"/></>,
  upload: <><path d="M12 16V4m-4 4 4-4 4 4M4 15v5h16v-5"/></>,
  close: <path d="m6.5 6.5 11 11m0-11-11 11"/>
};

export function Icon({name, size = 20, className = ""}) {
  return <svg aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" className={"ui-icon " + className}>{strokes[name]}</svg>;
}

export function PassportArt({className = ""}) {
  return <div className={"passport-art " + className} aria-hidden="true">
    <div className="folio-pages"/>
    <div className="folio">
      <div className="foil-title">IP PASSPORT</div>
      <div className="foil-globe"><i/><b/><em/></div>
      <div className="foil-chip"><i/></div>
    </div>
  </div>;
}
