#!/bin/bash
curl -s -w "\n%{http_code}" -X GET "$API_BASE_URL/restore/$FILE_VERSION_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Unique-Key: $UNIQUE_KEY" \
  -o repo.tar.zst.enc

if [ $? -ne 0 ]; then
  echo "::error ::Failed to download backup"
  exit 1
fi