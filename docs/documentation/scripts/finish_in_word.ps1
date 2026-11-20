# Opens the project documentation in Word, fills the index page numbers (PAGEREF fields),
# saves it and exports a PDF copy next to it. Microsoft Word must be installed.
# Run:  powershell -File docs/documentation/scripts/finish_in_word.ps1
$docx = (Resolve-Path "$PSScriptRoot\..\DisCharge+_Project_Documentation.docx").Path
$pdf = [IO.Path]::ChangeExtension($docx, ".pdf")

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    $doc = $word.Documents.Open($docx)
    $doc.Repaginate()
    [void]$doc.Fields.Update()
    $doc.Repaginate()
    [void]$doc.Fields.Update()
    $doc.Save()
    $doc.ExportAsFixedFormat($pdf, 17)  # 17 = PDF
    Write-Output "Pages: $($doc.ComputeStatistics(2))"
    $doc.Close()
} finally {
    try { $word.Quit() } catch { }
}
Write-Output "Updated $docx and wrote $pdf"
