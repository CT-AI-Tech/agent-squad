# Thin wrapper - the CI dry-run itself is cross-platform Node (tests/ci-dry-run.js).
node "$PSScriptRoot/ci-dry-run.js" @args
exit $LASTEXITCODE
