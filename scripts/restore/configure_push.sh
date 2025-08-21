#!/bin/bash
set -e
cd repo-mirror

TOKEN_TO_USE=${REPOSITORY_RESTORATION_TOKEN:-$GITHUB_DEFAULT_TOKEN}

git config user.name "iCredible File Security"
git config user.email "file-security@icredible.com"

git remote set-url origin "https://$TOKEN_TO_USE@github.com/$GITHUB_REPOSITORY.git"

git config --unset remote.origin.mirror
git for-each-ref --format="%(refname)" --sort='authordate' | xargs git push origin
git push --tags origin


echo "::notice title=Success!::Repository restored successfully"
