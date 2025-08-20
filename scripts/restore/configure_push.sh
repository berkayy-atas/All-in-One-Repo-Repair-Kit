#!/bin/bash
set -e
cd repo-mirror

TOKEN_TO_USE=${REPOSITORY_RESTORATION_TOKEN:-$GITHUB_DEFAULT_TOKEN}
[ -z "$REPOSITORY_RESTORATION_TOKEN" ]  && bash $ACTION_PATH/scripts/restore/filter_workflows.sh

git config user.name "iCredible File Security"
git config user.email "file-security@icredible.com"

git push --mirror --force "https://oauth2::$TOKEN_TO_USE@github.com/$GITHUB_REPOSITORY.git" > git_output.log 2>&1

echo "::notice title=Success!::Repository restored successfully"
