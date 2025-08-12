# All-in-One-Repo-Repair-Kit
## 📦 Setup

1. **Store your Activation Code** as a GitHub Secret  
   - Go to **Settings > Secrets > Actions** in your repository  
   - Create a new secret named `ACTIVATION_CODE`  
   - Paste in the activation code provided by your API service

2. **Store your Encryption PASSWORD** as a GitHub Secret  
   - Create a new secret named `ENCRYPTION_PASSWORD`  
   - Use a strong key of **at least 32 characters**

3. **Add your workflow file**  
   Create a file at `.github/workflows/backup.yml` and paste in the block below:

   ```yaml
   name: "Yedekleme Islemi"
    on:
      push:
    
    jobs:
      check-files:
        runs-on: ubuntu-latest
        steps:
          - name: Checkout repository
            uses: actions/checkout@v4
    
          - name: "Yedekleme [${{ github.event_name }}] #${{ github.run_number }}: ${{ github.sha }} by ${{ github.actor }}"
            uses: berkayy-atas/All-in-One-Repo-Repair-Kit@latest
            with:
              activation_code: ${{ secrets.ACTIVATION_CODE }}
              encryption_password: ${{ secrets.ENCRYPTION_PASSWORD }}
     ```
---


# 🔄 MyApp Repository Restore

Restores your GitHub repository from secure backups stored in MyApp File Security with end-to-end encryption and OTP verification.

## ⚠️ Note
This is designed for empty repositories — it will overwrite all history

---

## 🚀 Quick Start

```yaml
name: Restore Repository
permissions: write-all

on:
  workflow_dispatch:
    inputs:
      file_version_id:
        description: 'The version id of the file you want to restore. You can enter it in the first or second run while using the workflow. The version id you last entered is always kept and restored when the OTP code arrives.'
        required: true

jobs:
  restore:
    runs-on: ubuntu-latest
    steps:
      - name: "Restore Repository [${{ github.event_name }}] #${{ github.run_number }}: ${{ github.sha }} by ${{ github.actor }}"
        uses: berkayy-atas/All-in-One-Repo-Repair-Kit@latest
        with:
          activation_code: ${{ secrets.ACTIVATION_CODE }}
          encryption_password: ${{ secrets.ENCRYPTION_PASSWORD }}
          file_version_id: ${{ github.event.inputs.FILE_VERSION_ID }}
```
