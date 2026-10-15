# ============================================================
#  小云雀 Pippit -> Toonflow 供应商适配器  安装脚本
#  Xiaoyunque (Pippit) -> Toonflow provider adapter installer
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  小云雀 Pippit -> Toonflow  安装程序" -ForegroundColor Cyan
Write-Host "  ------------------------------------" -ForegroundColor DarkGray
Write-Host ""

$providerDir = "$env:LOCALAPPDATA\local.toonflow.desktop\stable\data\providers"

if (-not (Test-Path $providerDir)) {
    Write-Host "  [X] 没找到 Toonflow 的 providers 目录" -ForegroundColor Red
    Write-Host "      请确认已安装 Toonflow，并且至少启动过一次。" -ForegroundColor Yellow
    Write-Host "      预期路径: $providerDir" -ForegroundColor DarkGray
    exit 1
}
Write-Host "  [OK] 找到 providers 目录" -ForegroundColor Green

$source = Join-Path $PSScriptRoot "xyq.ts"
if (-not (Test-Path $source)) {
    Write-Host "  [X] 同目录下没找到 xyq.ts" -ForegroundColor Red
    exit 1
}

$target = Join-Path $providerDir "xyq.ts"

# 覆盖前先备份现有的同名文件，避免用户配置被冲掉
if (Test-Path $target) {
    $stamp  = Get-Date -Format "yyyyMMdd-HHmmss"
    $backup = "$target.bak-$stamp"
    Copy-Item -LiteralPath $target -Destination $backup -Force
    Write-Host "  [OK] 已备份旧文件 -> $backup" -ForegroundColor DarkGray
}

Copy-Item -LiteralPath $source -Destination $target -Force
Write-Host "  [OK] 已安装 -> $target" -ForegroundColor Green

Write-Host ""
Write-Host "  安装完成！接下来：" -ForegroundColor Cyan
Write-Host "    1. 重启 Toonflow" -ForegroundColor White
Write-Host "    2. 设置 -> 媒体模型 -> 选择「小云雀 Pippit」" -ForegroundColor White
Write-Host "    3. API Key 填你自己的 Access Key" -ForegroundColor White
Write-Host "       (获取地址: https://xyq.jianying.com -> CLI/API -> API)" -ForegroundColor DarkGray
Write-Host "    4. 请求地址保持默认 https://xyq.jianying.com" -ForegroundColor White
Write-Host ""
Write-Host "  详细说明见 README.md" -ForegroundColor Cyan
Write-Host ""