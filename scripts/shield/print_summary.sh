#!/bin/bash
summary=$(cat <<EOF
✅ **Backup completed successfully!**
---
**Git Metadata**
Repository: $GITHUB_REPOSITORY
Owner: ${GITHUB_REPOSITORY%/*} [$GITHUB_ACTOR]
Event: $GITHUB_EVENT_NAME
Ref: $GITHUB_REF
Actor: $GITHUB_ACTOR
---
**API Response**
File version id: $recordId
Access shielded file: $MGMT_BASE_URL/dashboard/file-management/$endpointId/$directoryRecordId
EOF
)

echo "::notice::$summary"