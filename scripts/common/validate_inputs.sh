#!/bin/bash

# --- DEBUG BAŞLANGIÇ ---
set -x # Çalıştırılan her komutu loglara basar.
echo "ACTION Değeri: '$ACTION'"
echo "FILE_VERSION_ID Değeri: '$FILE_VERSION_ID'"
echo "Şifre Uzunluğu: ${#ENCRYPTION_PASSWORD}"
echo "Aktivasyon Kodu Uzunluğu: ${#ACTIVATION_CODE}"
od -c /home/runner/work/_actions/berkayy-atas/All-in-One-Repo-Repair-Kit/latest/scripts/common/validate_inputs.sh
set +x # Debug modunu kapatır.
# --- DEBUG SON ---

if [ -z "$ACTIVATION_CODE" ]; then
  echo "::error ::Activation code cannot be left blank"
  exit 1
fi
if [ "${#ENCRYPTION_PASSWORD}" -lt 32 ]; then
  echo "::error ::Encryption password must be at least 32 characters (got ${#ENCRYPTION_PASSWORD})"
  exit 1
fi
if [[ "$ACTION" != "backup" && "$ACTION" != "restore" ]]; then
  echo "::error ::Invalid otp_request_type. Must be 'backup' or 'restore'"
  exit 1
fi
if [[ "$OTP_REQUEST_TYPE" != "MAIL" && "$OTP_REQUEST_TYPE" != "AUTHENTICATOR" ]]; then
  echo "::error ::Invalid otp_request_type. Must be 'MAIL' or 'AUTHENTICATOR'"
  exit 1
fi
if [[ "$ACTION" == "restore"  && -z "$FILE_VERSION_ID"  ]]; then
  echo "::error ::Input 'file_version_id' is required when action is 'restore'."
  exit 1
fi



