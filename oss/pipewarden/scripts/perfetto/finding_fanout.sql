-- finding_fanout.sql — DLP validation phases observed per scan.
--
-- Wired emit sites today:
--   * pipewarden.scan          (internal/analysis/claude.go)
--   * pipewarden.dlp.validate  (internal/analysis/dlp.go)
--
-- Counts dlp.validate slices per parent scan slice via slice.parent_id.
-- A future per-finding emit region will let this query count actual
-- findings; until then it tracks DLP phase fan-out as a proxy.

WITH fan AS (
  SELECT
    parent.id                                    AS scan_slice_id,
    COUNT(child.id)                              AS dlp_phases
  FROM slice parent
  LEFT JOIN slice child
    ON child.parent_id = parent.id
   AND child.name      = 'pipewarden.dlp.validate'
  WHERE parent.name = 'pipewarden.scan'
  GROUP BY parent.id
)
SELECT
  ROUND(AVG(dlp_phases), 2) AS avg_dlp_phases_per_scan,
  MAX(dlp_phases)           AS max_dlp_phases_per_scan,
  COUNT(*)                  AS scans_observed
FROM fan;
