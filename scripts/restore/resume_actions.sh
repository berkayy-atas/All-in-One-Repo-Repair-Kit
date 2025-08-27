#!/bin/bash
set -e

echo "Restoring original repository settings..."

MAX_RETRIES=3
RETRY_DELAY=5

if [ ! -f /tmp/$ACTIONS_PERM ]; then
  echo "Warning: Original permissions file not found. Re-enabling Actions with default settings."
  gh api \
    --method PUT \
    repos/$GITHUB_REPOSITORY/actions/permissions \
    -F 'enabled=true'
else
  original_perms=$(cat /tmp/$ACTIONS_PERM)
  
  # İzinleri restore et
  gh api \
    --method PUT \
    repos/$GITHUB_REPOSITORY/actions/permissions \
    --input /tmp/$ACTIONS_PERM
  
  # İzinlerin doğru şekilde uygulandığını kontrol et
  for attempt in $(seq 1 $MAX_RETRIES); do
    echo "Checking if permissions were restored correctly (attempt $attempt/$MAX_RETRIES)..."
    
    # Mevcut izinleri al
    current_perms=$(gh api repos/$GITHUB_REPOSITORY/actions/permissions --jq '.')
    
    # Beklenen izinleri al (JSON formatında)
    expected_enabled=$(echo "$original_perms" | jq -r '.enabled')
    expected_allowed_actions=$(echo "$original_perms" | jq -r '.allowed_actions')
    
    # Mevcut izinleri kontrol et
    current_enabled=$(echo "$current_perms" | jq -r '.enabled')
    current_allowed_actions=$(echo "$current_perms" | jq -r '.allowed_actions')
    
    if [ "$current_enabled" = "$expected_enabled" ] && \
       [ "$current_allowed_actions" = "$expected_allowed_actions" ]; then
      echo "✓ Permissions successfully restored:"
      echo "  - Enabled: $current_enabled"
      echo "  - Allowed actions: $current_allowed_actions"
      break
    else
      echo "✗ Permissions mismatch detected:"
      echo "  Expected - Enabled: $expected_enabled, Allowed actions: $expected_allowed_actions"
      echo "  Current  - Enabled: $current_enabled, Allowed actions: $current_allowed_actions"
      
      if [ $attempt -lt $MAX_RETRIES ]; then
        echo "Retrying in $RETRY_DELAY seconds..."
        sleep $RETRY_DELAY
        
        # Tekrar restore etmeyi dene
        gh api \
          --method PUT \
          repos/$GITHUB_REPOSITORY/actions/permissions \
          --input /tmp/$ACTIONS_PERM
      else
        echo "Error: Failed to restore permissions after $MAX_RETRIES attempts."
        echo "Please check your GitHub token permissions and try again."
        exit 1
      fi
    fi
  done
fi

echo "Repository actions have been successfully resumed."