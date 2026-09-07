param([Parameter(Mandatory = $true)][string]$Path)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression.FileSystem
$archive = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $Path))
try {
    $entries = @($archive.Entries | ForEach-Object { $_.FullName.Replace('\', '/') })
    foreach ($required in @("extension.vsixmanifest", "Bananify.VisualStudio.dll", "Bananify.Core.dll",
        "Community.VisualStudio.Toolkit.dll", "Microsoft.Web.WebView2.Core.dll", "Microsoft.Web.WebView2.Wpf.dll", "Newtonsoft.Json.dll",
        "Web/party.html", "Web/party.css", "Web/party.js", "Resources/banana.png", "LICENSE",
        "Themes/BananaGrove.pkgdef", "Themes/BananaCream.pkgdef", "Themes/MidnightBanana.pkgdef", "Themes/MonkeyJungle.pkgdef",
        "runtimes/win-x64/native/WebView2Loader.dll", "runtimes/win-arm64/native/WebView2Loader.dll")) {
        if (-not ($entries | Where-Object { $_ -eq $required -or $_.EndsWith("/$required") })) {
            throw "Missing VSIX payload: $required"
        }
    }
    if (-not ($entries | Where-Object { $_ -match '\.pkgdef$' })) { throw "Missing package registration." }
    $manifestEntry = $archive.GetEntry("extension.vsixmanifest")
    if ($null -eq $manifestEntry) { throw "Missing root VSIX manifest." }
    $reader = [System.IO.StreamReader]::new($manifestEntry.Open())
    try { [xml]$manifest = $reader.ReadToEnd() }
    finally { $reader.Dispose() }
    foreach ($asset in $manifest.PackageManifest.Assets.Asset) {
        $assetPath = ([string]$asset.Path).Replace('\', '/')
        if (-not $assetPath -or $entries -notcontains $assetPath) {
            throw "Manifest asset is absent from the VSIX: $assetPath"
        }
    }
    if ($entries | Where-Object { $_ -match '(^|/)(obj|node_modules|\.git)/' }) {
        throw "Build-only files leaked into the VSIX."
    }
    if ($entries -contains "Web/party.template.html") { throw "Authoring template leaked into the VSIX." }
    if ($entries | Where-Object { $_ -match '(^|/)(Microsoft\.VisualStudio\.(Shell|Text|ProjectSystem)|envdte)' }) {
        throw "Visual Studio host assemblies must not be redistributed inside this VSIX."
    }
    Write-Output "VSIX payload inspected. A VS2026 experimental-instance run is still required."
}
finally {
    $archive.Dispose()
}
