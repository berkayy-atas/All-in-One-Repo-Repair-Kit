#!/bin/bash
set -e
cd repo-mirror

TOKEN_TO_USE=${REPOSITORY_RESTORATION_TOKEN:-$GITHUB_DEFAULT_TOKEN}

git config user.name "iCredible File Security"
git config user.email "file-security@icredible.com"

git remote set-url origin "https://$TOKEN_TO_USE@github.com/$GITHUB_REPOSITORY.git"
git push --mirror origin "refs/remotes/origin/*:refs/heads/*"

echo "::notice title=Success!::Repository restored successfully"
