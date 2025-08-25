#!/bin/bash
set -e

echo "Restoring original repository settings..."

if [! -f /tmp/actions_permissions.json ]; then
  echo "Warning: Original permissions file not found. Re-enabling Actions with default settings."
  gh api \
    --method PUT \
    repos/$GITHUB_REPOSITORY/actions/permissions \
    -F 'enabled=true'
else
  echo "Found original permissions file. Restoring exact settings."
  gh api \
    --method PUT \
    repos/$GITHUB_REPOSITORY/actions/permissions \
    --input /tmp/actions_permissions.json
fi

echo "Repository settings have been successfully restored."
