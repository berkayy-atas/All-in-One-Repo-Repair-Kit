#!/bin/bash
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE_URL/OTP/Send" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "Source": "FileDownload",
    "OtpGenerationMode": "Number",
    "Type": "'"$OTP_TYPE"'"
  }')

HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)
JSON_BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_STATUS" -ne 200 ]; then
  echo "::error ::OTP request failed ($HTTP_STATUS): $(echo "$JSON_BODY" | jq -r '.message')"
  exit 1
fi

echo "UNIQUE_KEY=$(echo "$JSON_BODY" | jq -r '.data.uniqueKey')" >> $GITHUB_ENV
echo "CREATED_AT=$(echo "$JSON_BODY" | jq -r '.data.createdAt')" >> $GITHUB_ENV
echo "EXPIRES_AT=$(echo "$JSON_BODY" | jq -r '.data.expiresAt')" >> $GITHUB_ENV

# Generate OTP notification
QUERY_PARAMS="createdAt=$CREATED_AT&expiresAt=$EXPIRES_AT&uniqueKey=$UNIQUE_KEY&source=FileDownload"
echo "::notice ::Enter OTP at $MGMT_BASE_URL/git-security/?$QUERY_PARAMS"