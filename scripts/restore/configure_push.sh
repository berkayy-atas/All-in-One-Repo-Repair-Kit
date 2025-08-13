#!/bin/bash
cd repo-mirror

if [ -z "$RESTORE_TOKEN" ]; then
  echo "::warning ::Restoring without workflows https://github.com/berkayy-atas/All-in-One-Repo-Repair-Kit?tab=readme-ov-file#step-1-create-a-personal-access-token"
  sudo apt install git-filter-repo -y
  git filter-repo --force --path .github/workflows --invert-paths
  TOKEN="$GITHUB_TOKEN"
else
  TOKEN="$RESTORE_TOKEN"
fi

git config user.name "myapp File Security"
git config user.email "file-security@myapp.com"
git push --mirror --force "https://x-access-token:${TOKEN}@github.com/$GITHUB_REPOSITORY.git"

echo "::notice title=Success!::Repository restored successfully"