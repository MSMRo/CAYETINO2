# =============================================================================
# PROYECTO CAYETINO - FLASHEADOR AUTOMÁTICO DE FIRMWARE ESP32
# =============================================================================

param (
    [string]$Port = "",
    [int]$Baud = 921600
)

$Host.UI.RawUI.WindowTitle = "Flasheador Automático ESP32 - Cayetino"
Clear-Host

Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host "         ⚡ PROYECTO CAYETINO - FLASHEADOR AUTOMÁTICO ESP32             " -ForegroundColor White -BackgroundColor DarkBlue
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. Localizar binarios de firmware
$bootloaderBin = Join-Path $ScriptDir "cayetino_esp32.ino.bootloader.bin"
$partitionsBin = Join-Path $ScriptDir "cayetino_esp32.ino.partitions.bin"
$bootApp0Bin   = Join-Path $ScriptDir "boot_app0.bin"
$appBin        = Join-Path $ScriptDir "cayetino_esp32.ino.bin"
$mergedBin     = Join-Path $ScriptDir "cayetino_esp32.ino.merged.bin"

if (-not (Test-Path $appBin)) {
    Write-Host "❌ Error: No se encontró el archivo $appBin en la carpeta firmware." -ForegroundColor Red
    Write-Host "Presiona cualquier tecla para salir..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

# 2. Localizar esptool.exe
$esptoolExe = Join-Path $ScriptDir "esptool.exe"
if (-not (Test-Path $esptoolExe)) {
    # Buscar en carpeta Arduino15 si no estuviera aquí
    $arduinoTools = "$env:LOCALAPPDATA\Arduino15\packages\esp32\tools\esptool_py"
    if (Test-Path $arduinoTools) {
        $found = Get-ChildItem -Path $arduinoTools -Filter "esptool.exe" -Recurse | Select-Object -First 1
        if ($found) { $esptoolExe = $found.FullName }
    }
}

if (-not (Test-Path $esptoolExe)) {
    Write-Host "❌ Error: No se encontró esptool.exe para flashear el ESP32." -ForegroundColor Red
    Write-Host "Presiona cualquier tecla para salir..."
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}

Write-Host "🛠️ Herramienta de flasheo: esptool.exe encontrada." -ForegroundColor Gray

# 3. Detección automática del puerto COM
if ([string]::IsNullOrWhiteSpace($Port)) {
    Write-Host "🔍 Escaneando puertos COM disponibles (filtrando Bluetooth)..." -ForegroundColor Yellow

    $allPorts = @()
    try {
        $allPorts = Get-CimInstance Win32_SerialPort -ErrorAction SilentlyContinue | 
                    Where-Object { $_.Description -notmatch "Bluetooth" }
    } catch {}

    # Si WMI falla, fallback a System.IO.Ports
    if ($allPorts.Count -eq 0) {
        $rawNames = [System.IO.Ports.SerialPort]::GetPortNames()
        foreach ($r in $rawNames) {
            $allPorts += [PSCustomObject]@{ DeviceID = $r; Description = "Puerto Serial USB ($r)" }
        }
    }

    if ($allPorts.Count -eq 0) {
        Write-Host "⚠️ No se detectó ningún puerto COM conectado." -ForegroundColor Red
        Write-Host "Por favor conecta tu ESP32 por USB y presiona una tecla para reintentar..." -ForegroundColor Yellow
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        
        # Segundo intento
        $allPorts = Get-CimInstance Win32_SerialPort -ErrorAction SilentlyContinue | 
                    Where-Object { $_.Description -notmatch "Bluetooth" }
    }

    if ($allPorts.Count -eq 1) {
        $Port = $allPorts[0].DeviceID
        Write-Host "✅ ESP32 detectado automáticamente en: " -NoNewline -ForegroundColor Green
        Write-Host "$($allPorts[0].Description) ($Port)" -ForegroundColor White
    } elseif ($allPorts.Count -gt 1) {
        Write-Host "Se encontraron múltiples puertos serie conectados:" -ForegroundColor Cyan
        
        # Buscar si alguno es CP210x o CH340
        $preferred = $null
        for ($i = 0; $i -lt $allPorts.Count; $i++) {
            $p = $allPorts[$i]
            $isEsp = ($p.Description -match "CP210" -or $p.Description -match "CH34" -or $p.Description -match "UART")
            $mark = if ($isEsp) { "[Recomendado ESP32]" } else { "" }
            Write-Host "  [$($i+1)] $($p.DeviceID) - $($p.Description) $mark" -ForegroundColor (if ($isEsp) { "Green" } else { "White" })
            if ($isEsp -and -not $preferred) { $preferred = $p.DeviceID }
        }
        
        $prompt = if ($preferred) { "Selecciona puerto [1-$($allPorts.Count)] (Enter para $preferred): " } else { "Selecciona puerto [1-$($allPorts.Count)]: " }
        Write-Host ""
        $choice = Read-Host $prompt
        if ([string]::IsNullOrWhiteSpace($choice) -and $preferred) {
            $Port = $preferred
        } elseif ($choice -match '^\d+$' -and [int]$choice -ge 1 -and [int]$choice -le $allPorts.Count) {
            $Port = $allPorts[[int]$choice - 1].DeviceID
        } else {
            $Port = $choice.Trim()
        }
    } else {
        $Port = Read-Host "Ingresa manualmente el puerto COM del ESP32 (ej. COM7)"
    }
}

if ([string]::IsNullOrWhiteSpace($Port)) {
    Write-Host "❌ Puerto COM no válido. Operación cancelada." -ForegroundColor Red
    exit 1
}

# Normalizar nombre de puerto (ej. com7 -> COM7)
$Port = $Port.ToUpper()

Write-Host ""
Write-Host "------------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "🚀 Iniciando grabación de firmware Cayetino en $Port a $Baud baudios..." -ForegroundColor Cyan
Write-Host "------------------------------------------------------------------------" -ForegroundColor Gray
Write-Host ""

# 4. Ejecutar Flasheo
$flashArgs = @(
    "--chip", "esp32",
    "--port", $Port,
    "--baud", $Baud,
    "--before", "default-reset",
    "--after", "hard-reset",
    "write-flash", "-z",
    "--flash_mode", "dio",
    "--flash_freq", "80m",
    "--flash_size", "4MB",
    "0x1000", $bootloaderBin,
    "0x8000", $partitionsBin,
    "0xe000", $bootApp0Bin,
    "0x10000", $appBin
)

$proc = Start-Process -FilePath $esptoolExe -ArgumentList $flashArgs -NoNewWindow -Wait -PassThru

if ($proc.ExitCode -ne 0) {
    Write-Host ""
    Write-Host "⚠️ Falló la grabación a $Baud baudios. Reintentando a 115200 baudios por estabilidad..." -ForegroundColor Yellow
    $flashArgs[4] = "115200"
    $proc = Start-Process -FilePath $esptoolExe -ArgumentList $flashArgs -NoNewWindow -Wait -PassThru
}

Write-Host ""
if ($proc.ExitCode -eq 0) {
    Write-Host "========================================================================" -ForegroundColor Green
    Write-Host "  ✅ ¡FIRMWARE CAYETINO FLASHEADO CON ÉXITO EN EL ESP32!" -ForegroundColor White -BackgroundColor DarkGreen
    Write-Host "========================================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "El ESP32 se ha reiniciado y está listo para recibir comandos vía Web Serial." -ForegroundColor White
    Write-Host "Ya puedes abrir Cayetino 2 en tu navegador y conectar en $Port a 115200 baudios." -ForegroundColor Cyan
} else {
    Write-Host "========================================================================" -ForegroundColor Red
    Write-Host "  ❌ HUBO UN ERROR AL FLASHEAR EL ESP32 (Código: $($proc.ExitCode))" -ForegroundColor White -BackgroundColor DarkRed
    Write-Host "========================================================================" -ForegroundColor Red
    Write-Host "Verifica que el puerto $Port no esté abierto en otra aplicación (monitor serie o navegador)." -ForegroundColor Yellow
    Write-Host "Si tu ESP32 no entra en modo bootloader automáticamente, mantén presionado el botón BOOT mientras conectas." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Presiona cualquier tecla para cerrar esta ventana..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
