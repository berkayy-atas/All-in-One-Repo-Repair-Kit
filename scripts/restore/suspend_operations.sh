#!/bin/bash
set -e

echo "Reading current repository settings before suspension..."

gh api repos/$GITHUB_REPOSITORY/actions/permissions > /tmp/actions_permissions.json

echo "Current Actions permissions saved."

echo "Suspending repository operations (disabling Actions)..."
gh api \
  --method PUT \
  repos/$GITHUB_REPOSITORY/actions/permissions \
  -F enabled_repositories=none

echo "Actions have been successfully disabled."
