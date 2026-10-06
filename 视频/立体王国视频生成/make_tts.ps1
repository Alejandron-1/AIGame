# 读取 narration.json（UTF-8），用 Windows SAPI 中文语音逐条生成 WAV
Add-Type -AssemblyName System.Speech
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$jsonText = [System.IO.File]::ReadAllText("$here\narration.json", [System.Text.Encoding]::UTF8)
$json = $jsonText | ConvertFrom-Json

$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(
    16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen,
    [System.Speech.AudioFormat.AudioChannel]::Mono)

$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice('Microsoft Huihui Desktop')
$s.Volume = 100

New-Item -ItemType Directory -Force -Path "$here\audio" | Out-Null
foreach ($n in $json.shots) {
    $wav = "$here\audio\{0:d2}.wav" -f $n.no
    $s.Rate = $n.rate
    $s.SetOutputToWaveFile($wav, $fmt)
    $s.Speak($n.text) | Out-Null
    $s.SetOutputToNull()
    Write-Host ("OK {0:d2}.wav ({1})" -f $n.no, $n.role)
}
