#!/bin/bash
set -e
cd repo-mirror

TOKEN_TO_USE=${REPOSITORY_RESTORATION_TOKEN:-$GITHUB_DEFAULT_TOKEN}

git config user.name "iCredible File Security"
git config user.email "file-security@icredible.com"

REMOTE_URL="https://x-access-token:$TOKEN_TO_USE@github.com/$GITHUB_REPOSITORY.git"
git remote set-url origin "$REMOTE_URL"

echo "Local branches:"
git branch -a

echo "Pushing ALL branches individually..."
# Tüm local branch'leri tek tek pushla
for branch in $(git for-each-ref --format='%(refname:short)' refs/heads/); do
    echo "Pushing branch: $branch"
    git push "$REMOTE_URL" "$branch:$branch" --force
done

echo "Pushing ALL tags..."
git push "$REMOTE_URL" --tags --force

echo "Verifying pushed branches..."
# Push edilen branch'leri kontrol et
git ls-remote --heads "$REMOTE_URL"

echo "::notice title=Success!::Repository restored successfully"
