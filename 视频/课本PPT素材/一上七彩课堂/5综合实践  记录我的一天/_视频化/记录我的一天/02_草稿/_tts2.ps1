Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
$s.SelectVoice('Microsoft Huihui Desktop')
$s.Rate = -1
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
$s.SetOutputToWaveFile('C:\Users\aa109\Desktop\AIGame\视频\课本PPT素材\一上七彩课堂\5综合实践  记录我的一天\_视频化\记录我的一天\04_音频\S02_02_b1.wav', $fmt)
$s.Speak('淘气，你该出门啦！再不去上学就要迟到了！')
$s.SetOutputToNull()
$s.SetOutputToWaveFile('C:\Users\aa109\Desktop\AIGame\视频\课本PPT素材\一上七彩课堂\5综合实践  记录我的一天\_视频化\记录我的一天\04_音频\S02_02_b2.wav', $fmt)
$s.Speak('我们先吃早餐，我上班的时间还早呢。')
$s.SetOutputToNull()
$s.SetOutputToWaveFile('C:\Users\aa109\Desktop\AIGame\视频\课本PPT素材\一上七彩课堂\5综合实践  记录我的一天\_视频化\记录我的一天\04_音频\S02_02_b3.wav', $fmt)
$s.Speak('奇怪，妈妈怎么知道我上学要迟到了呢？爸爸为什么不着急上班呢？')
$s.SetOutputToNull()
$s.SetOutputToWaveFile('C:\Users\aa109\Desktop\AIGame\视频\课本PPT素材\一上七彩课堂\5综合实践  记录我的一天\_视频化\记录我的一天\04_音频\S02_02_b4.wav', $fmt)
$s.Speak('原来家里有钟表！')
$s.SetOutputToNull()