#!/bin/bash
set -e
cd repo-mirror

TOKEN_TO_USE=${REPOSITORY_RESTORATION_TOKEN:-$GITHUB_DEFAULT_TOKEN}
REMOTE_URL="https://x-access-token:$TOKEN_TO_USE@github.com/$GITHUB_REPOSITORY.git"

git config user.name "iCredible File Security"
git config user.email "file-security@icredible.com"

echo "=== CREATING LOCAL BRANCHES FROM REMOTE REFERENCES ==="

# Tüm remote reference'ları local branch'lere dönüştür
for remote_branch in $(git branch -r | grep -v '\->'); do
    # Branch adını temizle (origin/ prefixini kaldır)
    branch_name=${remote_branch#origin/}
    
    # Main branch'i atla (zaten var)
    if [ "$branch_name" = "main" ]; then
        continue
    fi
    
    echo "Creating local branch: $branch_name"
    
    # Local branch oluştur
    if ! git branch --list | grep -q " $branch_name$"; then
        git branch "$branch_name" "$remote_branch"
    else
        echo "Branch $branch_name already exists locally"
    fi
done

echo "=== LOCAL BRANCHES AFTER CREATION ==="
git branch -a

echo "=== PUSHING ALL BRANCHES TO REMOTE ==="

# Tüm local branch'leri pushla
for branch in $(git for-each-ref --format='%(refname:short)' refs/heads/); do
    echo "Pushing branch: $branch"
    git push "$REMOTE_URL" "$branch" --force
done

echo "=== PUSHING TAGS ==="
git push "$REMOTE_URL" --tags --force

echo "=== VERIFYING REMOTE BRANCHES ==="
# GitHub API ile branch'leri kontrol et
curl -s -H "Authorization: token $TOKEN_TO_USE" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/$GITHUB_REPOSITORY/branches" | \
  jq -r '.[].name'

echo "::notice title=Success!::Repository restored successfully"
