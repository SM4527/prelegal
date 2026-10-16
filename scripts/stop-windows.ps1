# Stop Prelegal and remove its container (the database goes with it).
Set-Location (Join-Path $PSScriptRoot "..")
docker compose down
exit $LASTEXITCODE
