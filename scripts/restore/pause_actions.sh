#!/bin/bash
set -e

echo "Reading current repository settings before suspension..."

gh api repos/$GITHUB_REPOSITORY/actions/permissions --jq '.' > /tmp/$ACTIONS_PERM

echo "Current permissions saved:"
cat /tmp/$ACTIONS_PERM

gh api \
  --method PUT \
  repos/$GITHUB_REPOSITORY/actions/permissions \
  -F 'enabled=false'
