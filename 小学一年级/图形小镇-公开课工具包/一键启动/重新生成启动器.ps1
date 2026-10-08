# 重新生成启动器（自定位版）：拷到任何电脑，双击右键"使用 PowerShell 运行"即可
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$pkg  = Split-Path -Parent $here                       # 图形小镇-公开课工具包
$aigame = Split-Path -Parent (Split-Path -Parent $pkg) # AIGame 根目录
$html = Join-Path $aigame '小学一年级\认识立体图形-图形小镇课件.html'
if (-not (Test-Path $html)) { Write-Host "未找到课件：$html"; Read-Host '按回车退出'; exit 1 }

$edge = @('C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
          'C:\Program Files\Microsoft\Edge\Application\msedge.exe') |
        Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { $edge = (Get-Command chrome.exe -ErrorAction SilentlyContinue).Source }
if (-not $edge) { Write-Host '未找到 Edge/Chrome'; Read-Host '按回车退出'; exit 1 }

$ws = New-Object -ComObject WScript.Shell
$items = @(
  @('01-完整课件(从头开始)', ''),
  @('02-第1关-认识小伙伴', '#game1'),
  @('03-认识长方体(3D)', '#feat-cuboid'),
  @('04-认识正方体(3D)', '#feat-cube'),
  @('05-认识圆柱(3D)', '#feat-cyl'),
  @('06-认识球(3D)', '#feat-ball'),
  @('07-玩一玩说一说', '#playtalk'),
  @('08-我说你猜', '#game2'),
  @('09-例1按形状分一分', '#game3'),
  @('10-数一数', '#count'),
  @('11-儿歌齐读', '#song')
)
$uri = 'file:///' + ($html -replace '\\', '/') -replace ' ', '%20'
foreach ($it in $items) {
  $lnk = $ws.CreateShortcut((Join-Path $here ($it[0] + '.lnk')))
  $lnk.TargetPath = $edge
  $lnk.Arguments = ('--app="' + $uri + $it[1] + '"')
  $lnk.IconLocation = $edge
  $lnk.Description = '立体图形小镇 · ' + $it[0]
  $lnk.Save()
  Write-Host ('已生成 ' + $it[0] + '.lnk')
}
Write-Host '全部完成！双击任意 .lnk 即玩。按回车退出。'
Read-Host
