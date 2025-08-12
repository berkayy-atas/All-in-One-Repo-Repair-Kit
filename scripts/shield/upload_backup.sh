#!/bin/bash

set -e

# If there is a valid commit, collect metadataa
if git rev-parse --verify HEAD >/dev/null 2>&1; then
    COMMIT=$(git log -1 --pretty=format:"%H")
    SHORT=$(git log -1 --pretty=format:"%h")
    PARENTS=$(git log -1 --pretty=format:"%P")
    AUTHOR=$(git log -1 --pretty=format:"%an <%ae>")
    DATE=$(git log -1 --pretty=format:"%ad")
    COMMITTER=$(git log -1 --pretty=format:"%cn")
    MESSAGE=$(git log -1 --pretty=format:"%s%n%b")
else
    COMMIT="" SHORT="" PARENTS="" AUTHOR="" DATE="" COMMITTER="" MESSAGE=""
fi

CURL_ARGS=(
    -F "MetaData[Event]=$GITHUB_EVENT_NAME"
    -F "MetaData[Ref]=$GITHUB_REF"
    -F "MetaData[Actor]=$GITHUB_ACTOR"
    -F "MetaData[Owner]=$GITHUB_REPOSITORY_OWNER"
    -F "MetaData[OwnerType]=$GITHUB_EVENT_REPOSITORY_OWNER_TYPE"
)

[ -n "$COMMIT" ] && CURL_ARGS+=(-F "MetaData[Commit]=$COMMIT")
[ -n "$SHORT" ] && CURL_ARGS+=(-F "MetaData[CommitShort]=$SHORT")
[ -n "$PARENTS" ] && CURL_ARGS+=(-F "MetaData[Parents]=$PARENTS")
[ -n "$AUTHOR" ] && CURL_ARGS+=(-F "MetaData[Author]=$AUTHOR")
[ -n "$DATE" ] && CURL_ARGS+=(-F "MetaData[Date]=$DATE")
[ -n "$COMMITTER" ] && CURL_ARGS+=(-F "MetaData[Committer]=$COMMITTER")
[ -n "$MESSAGE" ] && CURL_ARGS+=(-F "MetaData[Message]=$MESSAGE")


RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "$API_BASE_URL/backup/shield" \
    -H "Authorization: Bearer $TOKEN" \
    -F "file=@$ENC_FILE_NAME" \
    -F "Size=$UNCOMPRESSED_SIZE" \
    -F "CompressedFileSize=$COMPRESSED_SIZE" \
    -F "Attributes=32" \
    -F "FileName=${GITHUB_REPOSITORY}" \
    -F "CompressionEngine=None" \
    -F "CompressionLevel=NoCompression" \
    -F "FullPath=/${GITHUB_REPOSITORY}/repo.tar.zst" \
    -F "encryptionType=None" \
    -F "RevisionType=1" \
    "${CURL_ARGS[@]}"
)

HTTP_STATUS=$(echo "$RESPONSE" | tail -n1)
JSON_BODY=$(echo "$RESPONSE" | head -n -1)

if [ "$HTTP_STATUS" -ne 200 ]; then
    echo "::error ::Upload failed: $JSON_BODY"
    exit 1
fi

echo "recordId=$(echo "$JSON_BODY" | jq -r '.data.recordId')" >> "$GITHUB_ENV"
echo "directoryRecordId=$(echo "$JSON_BODY" | jq -r '.data.directoryRecordId')" >> "$GITHUB_ENV"

echo "commit=$COMMIT" >> "$GITHUB_ENV"
echo "commitShort=$SHORT" >> "$GITHUB_ENV"
echo "parents=$PARENTS" >> "$GITHUB_ENV"
echo "author=$AUTHOR" >> "$GITHUB_ENV"
echo "date=$DATE" >> "$GITHUB_ENV"
echo "committer=$COMMITTER" >> "$GITHUB_ENV"
ENCODED_MESSAGE=$(echo -n "$MESSAGE" | base64)
echo "message_b64=$ENCODED_MESSAGE" >> "$GITHUB_ENV"

echo "Backup successfully uploaded. Summary being created..."