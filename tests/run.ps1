# Thin wrapper - the suite itself is cross-platform Node (tests/run.js).
node "$PSScriptRoot/run.js" @args
exit $LASTEXITCODE
