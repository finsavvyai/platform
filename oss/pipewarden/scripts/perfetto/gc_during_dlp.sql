-- gc_during_dlp.sql — GC pause time observed inside DLP validate phase.
--
-- Joins `pipewarden.dlp.validate` slices (wired in
-- internal/analysis/dlp.go::ValidateFindings) to runtime/trace's GC
-- slices. After conversion via gotraceui, GC slices are exposed in
-- Perfetto with names matching `GC %`.

SELECT
  SUM(gc.dur) / 1e6                             AS gc_ms_during_dlp,
  COUNT(gc.id)                                  AS gc_events,
  COUNT(DISTINCT dlp.id)                        AS dlp_phases
FROM slice dlp
JOIN slice gc
  ON gc.ts >= dlp.ts
 AND gc.ts <= dlp.ts + dlp.dur
 AND gc.name LIKE 'GC %'
WHERE dlp.name = 'pipewarden.dlp.validate';
