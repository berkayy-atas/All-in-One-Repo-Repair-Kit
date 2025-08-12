#!/bin/bash
cd repo-mirror

if [ -z "$RESTORE_TOKEN" ]; then
  echo "::warning ::Restoring without workflows"
  sudo apt install git-filter-repo -y
  git filter-repo --force --path .github/workflows --invert-paths
  TOKEN="$GITHUB_TOKEN"
else
  TOKEN="$RESTORE_TOKEN"
fi

git config user.name "myapp File Security"
git config user.email "file-security@myapp.com"
git push --mirror --force "https://x-access-token:${TOKEN}@github.com/$GITHUB_REPOSITORY.git"

echo "::notice ::Repository restored successfully"