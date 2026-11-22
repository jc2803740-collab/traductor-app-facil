param(
    [switch]$NoBrowser,
    [int]$PreferredPort = 8792
)

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Open-AppWindow([string]$Url) {
    $browserCandidates = @(
        "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
        "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe",
        "$env:LOCALAPPDATA\Microsoft\Edge\Application\msedge.exe",
        "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    )
    foreach ($exe in $browserCandidates) {
        if ($exe -and (Test-Path $exe)) {
            Start-Process -FilePath $exe -ArgumentList "--app=$Url", "--window-size=980,820"
            return
        }
    }
    Start-Process $Url
}

try {
    $ping = Invoke-RestMethod -Uri "http://localhost:$PreferredPort/api/ping" -TimeoutSec 1 -ErrorAction Stop
    if ($ping -and $ping.app -eq "traductor_app_facil") {
        if (-not $NoBrowser) { Open-AppWindow "http://localhost:$PreferredPort/" }
        exit 0
    }
} catch {}

$Listener = $null
$Port = $PreferredPort
for ($p = $PreferredPort; $p -le ($PreferredPort + 10); $p++) {
    $candidate = New-Object System.Net.HttpListener
    $candidate.Prefixes.Add("http://localhost:$p/")
    try {
        $candidate.Start()
        $Listener = $candidate
        $Port = $p
        break
    } catch {
        try { $candidate.Close() } catch {}
    }
}
if (-not $Listener) { exit 1 }

if (-not $NoBrowser) { Open-AppWindow "http://localhost:$Port/" }

$MimeTypes = @{
    ".html"        = "text/html; charset=utf-8"
    ".js"          = "application/javascript; charset=utf-8"
    ".css"         = "text/css; charset=utf-8"
    ".json"        = "application/json; charset=utf-8"
    ".webmanifest" = "application/manifest+json; charset=utf-8"
    ".svg"         = "image/svg+xml"
    ".png"         = "image/png"
}

$LastActivity = [DateTime]::UtcNow

try {
    $Async = $Listener.BeginGetContext($null, $null)
    while ($Listener.IsListening) {
        if ($Async.AsyncWaitHandle.WaitOne(1000)) {
            $Context = $Listener.EndGetContext($Async)
            $Req = $Context.Request
            $Res = $Context.Response
            $Res.Headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
            $Path = $Req.Url.AbsolutePath
            $LastActivity = [DateTime]::UtcNow
            try {
                if ($Path -eq "/api/ping") {
                    $bytes = [System.Text.Encoding]::UTF8.GetBytes('{"ok":true,"app":"traductor_app_facil"}')
                    $Res.ContentType = "application/json; charset=utf-8"
                    $Res.StatusCode = 200
                    $Res.OutputStream.Write($bytes, 0, $bytes.Length)
                } else {
                    $rel = if ($Path -eq "/") { "index.html" } else { $Path.TrimStart("/").Replace("/", "\") }
                    $filePath = Join-Path $RootDir $rel
                    if (Test-Path $filePath -PathType Leaf) {
                        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
                        $Res.ContentType = if ($MimeTypes.ContainsKey($ext)) { $MimeTypes[$ext] } else { "application/octet-stream" }
                        $bytes = [System.IO.File]::ReadAllBytes($filePath)
                        $Res.StatusCode = 200
                        $Res.OutputStream.Write($bytes, 0, $bytes.Length)
                    } else {
                        $Res.StatusCode = 404
                    }
                }
            } finally {
                try { $Res.OutputStream.Close() } catch {}
            }
            $Async = $Listener.BeginGetContext($null, $null)
        }
        if (([DateTime]::UtcNow - $LastActivity).TotalMinutes -gt 120) { break }
    }
} finally {
    try { $Listener.Stop(); $Listener.Close() } catch {}
}
