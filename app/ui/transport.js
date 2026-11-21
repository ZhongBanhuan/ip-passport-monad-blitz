export function sitePath(path) { return (process.env.NEXT_PUBLIC_PAGES_BASE || '')+path; }
export function requestApi(path,options) { return fetch(path,options); }
