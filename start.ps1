# Starts the SAATH backend (port 8000) and frontend (port 5173) in two new windows.
# First run installs everything. Usage:  powershell -ExecutionPolicy Bypass -File .\start.ps1
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'

if (-not (Test-Path (Join-Path $backend '.venv'))) {
    Write-Host 'Creating Python environment...'
    py -3 -m venv (Join-Path $backend '.venv')
    & (Join-Path $backend '.venv\Scripts\python.exe') -m pip install -q -r (Join-Path $backend 'requirements.txt')
}
if (-not (Test-Path (Join-Path $backend '.env'))) {
    Copy-Item (Join-Path $backend '.env.example') (Join-Path $backend '.env')
    Write-Host 'Created backend\.env - add your GEMINI_API_KEY there (optional).'
}
if (-not (Test-Path (Join-Path $frontend 'node_modules'))) {
    Write-Host 'Installing frontend packages...'
    Push-Location $frontend; npm install; Pop-Location
}

Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$backend'; .\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"
Start-Process powershell -ArgumentList '-NoExit', '-Command', "Set-Location '$frontend'; npm run dev"
Start-Sleep -Seconds 4
Start-Process 'http://localhost:5173'
