# ─── 自動push スクリプト ───
# このスクリプトを起動しておくと、ファイル変更を検知して自動でGitHubにpushします
# 停止したいときは Ctrl + C

$folder = "C:\Users\d20762\Documents\GitHub\wc2026-prediction"
Set-Location $folder

# GitHub Desktop に同梱されている git を探す
$gitExe = Get-ChildItem "$env:LOCALAPPDATA\GitHubDesktop\app-*\resources\app\git\cmd\git.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($gitExe) {
  $env:Path = "$($gitExe.DirectoryName);$env:Path"
  Write-Host "Git found: $($gitExe.FullName)" -ForegroundColor Green
} else {
  Write-Host "Git が見つかりません。GitHub Desktop が正しくインストールされているか確認してください。" -ForegroundColor Red
  exit
}

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  自動push 監視開始" -ForegroundColor Cyan
Write-Host "  フォルダ: $folder" -ForegroundColor Cyan
Write-Host "  停止: Ctrl + C" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

while ($true) {
  Start-Sleep -Seconds 30

  $changes = git status --porcelain 2>$null
  if ($changes) {
    $time = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$time] 変更を検知 → push します..." -ForegroundColor Yellow

    git add . 2>&1 | Out-Null
    git commit -m "Auto-commit $time" 2>&1 | Out-Null
    $pushResult = git push 2>&1
    if ($LASTEXITCODE -eq 0) {
      Write-Host "[$time] ✅ Push 成功（3〜5分後にURLに反映）" -ForegroundColor Green
    } else {
      Write-Host "[$time] ❌ Push 失敗: $pushResult" -ForegroundColor Red
    }
    Write-Host ""
  }
}
