#!/bin/bash
set -e
cd repo-mirror

TOKEN_TO_USE=${REPOSITORY_RESTORATION_TOKEN:-$GITHUB_DEFAULT_TOKEN}

git config user.name "iCredible File Security"
git config user.email "file-security@icredible.com"

git remote add githu1b "https://x-access-token:$TOKEN_TO_USE@github.com/$GITHUB_REPOSITORY.git"
git push --mirror --force githu1b


echo "::notice title=Success!::Repository restored successfully"
