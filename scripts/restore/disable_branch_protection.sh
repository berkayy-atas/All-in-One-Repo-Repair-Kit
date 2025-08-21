#!/bin/bash
set -e

TOKEN_TO_USE=$REPOSITORY_RESTORATION_TOKEN
REPO_OWNER=$(echo $GITHUB_REPOSITORY | cut -d'/' -f1)
REPO_NAME=$(echo $GITHUB_REPOSITORY | cut -d'/' -f2)

echo "Fetching protected branches..."
PROTECTED_BRANCHES=$(curl -s -H "Authorization: token $TOKEN_TO_USE" \
  -H "Accept: application/vnd.github.v3+json" \
  "https://api.github.com/repos/$GITHUB_REPOSITORY/branches?protected=true" | \
  jq -r '.[].name')

echo "Protected branches found: $PROTECTED_BRANCHES"

# Koruma ayarlarını geçici olarak devre dışı bırak
for branch in $PROTECTED_BRANCHES; do
    echo "Disabling protection for branch: $branch"
    curl -s -X DELETE \
      -H "Authorization: token $TOKEN_TO_USE" \
      -H "Accept: application/vnd.github.v3+json" \
      "https://api.github.com/repos/$GITHUB_REPOSITORY/branches/$branch/protection" || \
      echo "⚠️ Could not disable protection for $branch (may not be protected or no permissions)"
done

# Koruma ayarlarını kaydet (sonra tekrar eklemek için)
PROTECTION_BACKUP_FILE="/tmp/branch_protection_backup.json"
echo "[]" > "$PROTECTION_BACKUP_FILE"

for branch in $PROTECTED_BRANCHES; do
    echo "Backing up protection settings for: $branch"
    protection_settings=$(curl -s \
      -H "Authorization: token $TOKEN_TO_USE" \
      -H "Accept: application/vnd.github.v3+json" \
      "https://api.github.com/repos/$GITHUB_REPOSITORY/branches/$branch/protection" 2>/dev/null || echo "{}")
    
    # Backup dosyasına ekle
    jq --arg branch "$branch" --argjson settings "$protection_settings" \
      '. += [{"branch": $branch, "protection": $settings}]' \
      "$PROTECTION_BACKUP_FILE" > "/tmp/temp_backup.json" && \
      mv "/tmp/temp_backup.json" "$PROTECTION_BACKUP_FILE"
done

echo "Branch protections disabled temporarily"