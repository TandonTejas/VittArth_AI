$exclude = @('node_modules', '.git', '__pycache__', '.pytest_cache', 'dist', 'test-results', '.venv')

function Show-Tree {
    param (
        [string]$Path = '.',
        [string]$Indent = ''
    )
    $items = Get-ChildItem -LiteralPath $Path | Where-Object { $_.Name -notin $exclude }
    foreach ($item in $items) {
        "$Indent+-- $($item.Name)"
        if ($item.PSIsContainer) {
            Show-Tree -Path $item.FullName -Indent "$Indent|   "
        }
    }
}

'finguard-ai/' | Out-File -FilePath 'structure.txt' -Encoding UTF8
Show-Tree -Path 'finguard-ai' | Out-File -FilePath 'structure.txt' -Encoding UTF8 -Append
Write-Host 'Done'
