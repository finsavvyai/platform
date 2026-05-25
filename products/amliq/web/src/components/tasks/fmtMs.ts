export function fmtMs(ms: number) {
  if (!ms) return '\u2014'
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}
