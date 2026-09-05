# ============================================================================
# Repair remote migration history so it matches the local supabase/migrations folder.
#
# WHY: The remote database (linked project) has ~60 migration history entries that
#      were never saved as local files (created via Studio UI / SQL editor / MCP).
#      The local folder only tracks 3 migrations. `supabase db pull` refuses to run
#      until history and local files agree.
#
# WHAT THIS DOES (and does NOT do):
#   - `migration repair --status reverted <v>`  =>  DELETES the history row for <v>
#     from supabase_migrations.schema_migrations on the REMOTE database.
#     It does NOT touch any schema object (tables, RLS, functions stay as-is).
#   - `migration repair --status applied  <v>`  =>  INSERTS a history row claiming <v>
#     ran, WITHOUT running it. Used because the schema for those 3 migrations already
#     exists live.
#
#   !! Flag is DESTRUCTIVE to history bookkeeping. Have the team agree before
#      running. After this + `supabase db pull`, the repo gets a one-time "baseline"
#      migration that captures the entire current remote schema.
#
# NOTE: `supabase db pull --linked` may prompt for the remote DB password in your
#       terminal. That is expected and fine to type interactively.
# ============================================================================

$ErrorActionPreference = 'Stop'

# Versions that exist ONLY in remote history (no local file). Removed from history.
$reverted = @(
  '20251101072457', '20251101072550', '20251101130501', '20251102', '20251103',
  '20251104103000', '20251106124157', '20251110154100', '20251111071400',
  '20251212061103', '20260308130356',
  '20260329140443', '20260329140456', '20260329140517', '20260329140545',
  '20260329180945', '20260329181148', '20260329181303', '20260329183958',
  '20260329184024', '20260329184108', '20260329184326', '20260329184414',
  '20260329184436', '20260329185709', '20260330090158', '20260401112547',
  '20260828115641', '20260828115703', '20260828115721', '20260828115729',
  '20260828115744', '20260828115826', '20260828115837', '20260828115852',
  '20260828115934', '20260828115956', '20260828121623',
  '20260831105138', '20260831105200', '20260831105216', '20260831105230',
  '20260831105255', '20260831105309', '20260831105320', '20260831105330',
  '20260831105348', '20260831105441', '20260831105554', '20260831105613',
  '20260831105649', '20260831105715', '20260831105731', '20260831105740',
  '20260831105921', '20260831110013', '20260831143859', '20260831144439',
  '20260901060737', '20260901061211'
)

# Versions that exist locally AND were already applied to remote. Kept as applied.
$applied = @(
  '20260831132600',
  '20260831132601',
  '20260831143352'
)

Write-Host "Marking $($reverted.Count) remote-only migrations as reverted..." -ForegroundColor Yellow
foreach ($v in $reverted) {
  Write-Host "  supabase migration repair --status reverted $v"
  supabase migration repair --status reverted $v
  if ($LASTEXITCODE -ne 0) { throw "Repair failed for $v" }
}

Write-Host "Marking $($applied.Count) local migrations as applied..." -ForegroundColor Yellow
foreach ($v in $applied) {
  Write-Host "  supabase migration repair --status applied $v"
  supabase migration repair --status applied $v
  if ($LASTEXITCODE -ne 0) { throw "Repair failed for $v" }
}

Write-Host ""
Write-Host "Migration history repaired. Verify with:" -ForegroundColor Green
Write-Host "  supabase migration list"
Write-Host ""
Write-Host "Then pull the remote schema as a baseline migration:" -ForegroundColor Green
Write-Host "  supabase db pull --linked -s public"