#!/usr/bin/env bash
# Thin wrapper - the CI dry-run itself is cross-platform Node (tests/ci-dry-run.js).
exec node "$(dirname "$0")/ci-dry-run.js" "$@"
