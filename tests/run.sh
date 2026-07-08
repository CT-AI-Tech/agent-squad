#!/usr/bin/env bash
# Thin wrapper - the suite itself is cross-platform Node (tests/run.js).
exec node "$(dirname "$0")/run.js" "$@"
