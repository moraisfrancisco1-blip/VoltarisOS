@echo off
rem ============================================================================
rem  Marstek Venus - read-only probe (Windows, nothing to install)
rem
rem  Double-click this file while your PC is on the SAME Wi-Fi/network as the
rem  Marstek battery and "Open API" is switched on in the Marstek app.
rem  Optional: marstek_probe.bat 192.168.1.50   (the battery's IP; otherwise it
rem  is found automatically).
rem
rem  It only READS data (never changes the battery). Your IP, MAC addresses and
rem  Wi-Fi name are removed from the result. The result is shown here, saved on
rem  your Desktop (marstek_probe_output.json) and copied to the clipboard.
rem
rem  If Windows asks to allow PowerShell on the network, click ALLOW (private
rem  networks): the battery answers on UDP port 30000 and needs that.
rem ============================================================================
if not "%~1"=="" set MARSTEK_IP=%~1
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ((Get-Content -Raw -LiteralPath '%~f0') -split ('#PS'+'START'))[1]"
if not defined MARSTEK_NOPAUSE pause
exit /b
#PSSTART
$ErrorActionPreference = 'Stop'
$ip         = $env:MARSTEK_IP
$port       = if ($env:MARSTEK_PORT)      { [int]$env:MARSTEK_PORT }      else { 30000 }
$localPort  = if ($env:MARSTEK_LOCALPORT) { [int]$env:MARSTEK_LOCALPORT } else { $port }
$outFile    = if ($env:MARSTEK_OUT)       { $env:MARSTEK_OUT } else { Join-Path ([Environment]::GetFolderPath('Desktop')) 'marstek_probe_output.json' }
$timeoutMs  = if ($env:MARSTEK_TIMEOUT_MS){ [int]$env:MARSTEK_TIMEOUT_MS } else { 5000 }
$pauseMs    = if ($env:MARSTEK_PAUSE_MS)  { [int]$env:MARSTEK_PAUSE_MS }  else { 300 }

# Read-only methods only. Nothing else is ever sent.
$methods = @('Marstek.GetDevice', 'ES.GetStatus', 'ES.GetMode', 'Bat.GetStatus', 'PV.GetStatus', 'EM.GetStatus')

function Send-Json($udp, [string]$json, [string]$to, [int]$toPort) {
    $bytes = [Text.Encoding]::UTF8.GetBytes($json)
    [void]$udp.Send($bytes, $bytes.Length, $to, $toPort)
}

# Next datagram whose JSON "id" equals $id (raw text + sender), or $null on timeout.
function Wait-Answer($udp, [int]$id, [int]$ms) {
    $deadline = [DateTime]::UtcNow.AddMilliseconds($ms)
    while ($true) {
        $left = [int]($deadline - [DateTime]::UtcNow).TotalMilliseconds
        if ($left -le 0) { return $null }
        $udp.Client.ReceiveTimeout = $left
        $remote = New-Object System.Net.IPEndPoint ([System.Net.IPAddress]::Any, 0)
        try { $data = $udp.Receive([ref]$remote) } catch { continue }   # timeout / ICMP reset: keep waiting until the deadline
        $text = [Text.Encoding]::UTF8.GetString($data)
        try { $obj = $text | ConvertFrom-Json } catch { continue }
        # A message with "method" is a REQUEST (our own broadcast looping back to this PC), not the battery's answer.
        if ($null -ne $obj.method) { continue }
        if ($null -ne $obj.id -and [int]$obj.id -eq $id) { return @{ Text = $text; From = $remote.Address.ToString() } }
    }
}

function Get-Broadcasts {
    $list = @('255.255.255.255')
    try {
        $s = New-Object System.Net.Sockets.UdpClient
        $s.Connect('192.0.2.1', 9)   # sends nothing; only learns which local interface is used
        $local = $s.Client.LocalEndPoint.Address.ToString()
        $s.Close()
        $b = ($local.Split('.')[0..2] -join '.') + '.255'               # assumes a /24 home network
        if ($list -notcontains $b) { $list += $b }
    } catch { }
    return $list
}

Write-Host ''
Write-Host 'Marstek probe (read-only)...'
$udp = New-Object System.Net.Sockets.UdpClient ($localPort)
$udp.EnableBroadcast = $true
try {
    if (-not $ip) {
        Write-Host 'Looking for the battery on your network (about 6 seconds)...'
        $disc = '{"id":0,"method":"Marstek.GetDevice","params":{"ble_mac":"0"}}'
        $end = [DateTime]::UtcNow.AddSeconds(6)
        while (-not $ip -and [DateTime]::UtcNow -lt $end) {
            foreach ($b in (Get-Broadcasts)) { try { Send-Json $udp $disc $b $port } catch { } }
            $a = Wait-Answer $udp 0 2000
            if ($a) { $ip = $a.From }
        }
        if (-not $ip) {
            throw 'No Marstek battery answered. Check that Open API is ON in the Marstek app, that this PC is on the same Wi-Fi as the battery, and that you clicked Allow if Windows asked about the network.'
        }
        Write-Host 'Battery found.'
    }

    $parts = @()
    $id = 0
    foreach ($m in $methods) {
        $id++
        $params = if ($m -eq 'Marstek.GetDevice') { '{"ble_mac":"0"}' } else { '{"id":0}' }
        $req = '{"id":' + $id + ',"method":"' + $m + '","params":' + $params + '}'
        $entry = '{"error":"no answer (timeout)"}'
        for ($try = 1; $try -le 2; $try++) {
            Send-Json $udp $req $ip $port
            $a = Wait-Answer $udp $id $timeoutMs
            if ($a) { $entry = $a.Text.Trim(); break }
        }
        Write-Host ("  {0,-20} {1}" -f $m, $(if ($entry -like '*no answer*') { 'no answer' } else { 'ok' }))
        $parts += ('"' + $m + '": ' + $entry)
        Start-Sleep -Milliseconds $pauseMs
    }
    $json = '{"probe_version": 2, "target": "' + $ip + '", "methods": {' + "`r`n  " + ($parts -join (",`r`n  ")) + "`r`n}}"

    if (($parts | Where-Object { $_ -notlike '*no answer (timeout)*' }).Count -eq 0) {
        Write-Host ''
        Write-Host 'The battery did not answer any request.' -ForegroundColor Yellow
        Write-Host '  - Is "Open API" switched ON in the Marstek app (UDP port 30000)?'
        Write-Host '  - Is this PC on the same Wi-Fi/network as the battery (not a guest network)?'
        Write-Host '  - Did you click ALLOW when Windows asked about PowerShell and the network?'
        Write-Host '  - If you know the battery IP, run:  marstek_probe.bat 192.168.1.50'
    }
    # Remove network identifiers (values only; field names and measurements are kept).
    $json = [regex]::Replace($json, '"(target|ip|mac|wifi_mac|ble_mac|wifi_name|ssid|bssid|src)"\s*:\s*"[^"]*"', '"$1": "<redacted>"')

    [IO.File]::WriteAllText($outFile, $json, (New-Object Text.UTF8Encoding $false))
    try { Set-Clipboard -Value $json } catch { }
    Write-Host ''
    Write-Host $json
    Write-Host ''
    Write-Host ('Saved to: ' + $outFile)
    Write-Host 'It is also copied to your clipboard: paste it into your message (Ctrl+V).'
} catch {
    Write-Host ''
    Write-Host ('Probe failed: ' + $_.Exception.Message) -ForegroundColor Red
} finally {
    $udp.Close()
}
