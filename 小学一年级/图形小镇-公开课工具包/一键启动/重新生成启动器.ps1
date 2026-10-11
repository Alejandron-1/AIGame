# 重新生成启动器（自定位版）：指向同目录下的独立游戏 HTML，双击 = Edge 无边框全屏
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$edge = @('C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
          'C:\Program Files\Microsoft\Edge\Application\msedge.exe') |
        Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { $edge = (Get-Command chrome.exe -ErrorAction SilentlyContinue).Source }
if (-not $edge) { Write-Host '未找到 Edge/Chrome'; Read-Host '按回车退出'; exit 1 }

$ws = New-Object -ComObject WScript.Shell
$files = Get-ChildItem -Path $here -Filter '*.html' | Sort-Object Name
foreach ($f in $files) {
  $url = 'file:///' + ($f.FullName -replace '\\', '/') -replace ' ', '%20'
  $lnk = $ws.CreateShortcut((Join-Path $here ($f.BaseName + '.lnk')))
  $lnk.TargetPath = $edge
  $lnk.Arguments = ('--app="' + $url + '"')
  $lnk.IconLocation = $edge
  $lnk.Save()
  Write-Host ('已生成 ' + $f.BaseName + '.lnk')
}
Write-Host '全部完成！双击任意 .lnk = 无边框全屏玩该游戏。按回车退出。'
Read-Host
