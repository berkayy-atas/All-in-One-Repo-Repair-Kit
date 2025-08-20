#!/bin/bash
set -e
cd repo-mirror

TOKEN_TO_USE=${REPOSITORY_RESTORATION_TOKEN:-$GITHUB_DEFAULT_TOKEN}
[ -z "$REPOSITORY_RESTORATION_TOKEN" ]  && bash $ACTION_PATH/scripts/restore/filter_workflows.sh

git config user.name "iCredible File Security"
git config user.email "file-security@icredible.com"


echo "::group::Git Push Komutu Hata Ayıklama Çıktısı"
echo "Push komutu şimdi çalıştırılacak..."
echo "--------------------------------------------------"

# Hata ayıklama için Git'i daha "konuşkan" yapalım ve tüm çıktıları (stderr dahil) alalım
GIT_TRACE=1 GIT_CURL_VERBOSE=1 git push --mirror --force "https://oauth2::$TOKEN_TO_USE@github.com/$GITHUB_REPOSITORY.git" > git_output.log 2>&1

# Push komutunun çıkış kodunu (başarılıysa 0, değilse 0'dan farklı) yakala
exit_code=$?

# Git komutunun tüm çıktısını loglara basalım
cat git_output.log

echo "--------------------------------------------------"
echo "Push komutu tamamlandı. Çıkış Kodu: $exit_code"
echo "::endgroup::"


# Eğer push işlemi başarısız olduysa, ek bilgiler toplayalım
if [ $exit_code -ne 0 ]; then
  echo "::error::Git push işlemi başarısız oldu! (Çıkış Kodu: $exit_code). Depo durumu kontrol ediliyor..."
  
  echo "::group::Yerel Depo Durumu (Hata Anında)"
  echo "--- git status ---"
  git status
  echo ""
  echo "--- git branch -a ---"
  git branch -a
  echo ""
  echo "--- git log -n 5 --oneline ---"
  git log -n 5 --oneline
  echo "::endgroup::"
  
  # Action'ı hata koduyla sonlandır
  exit $exit_code
fi

echo "::notice title=Success!::Repository restored successfully"

echo "::notice title=Success!::Repository restored successfully"
