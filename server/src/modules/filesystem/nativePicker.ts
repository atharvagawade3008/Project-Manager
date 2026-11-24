import { exec } from 'child_process';
import path from 'path';

export function openNativeFolderPicker(): Promise<string | null> {
  return new Promise((resolve) => {
    // PowerShell script to invoke FolderBrowserDialog
    const psScript = `
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = "Select a Project Folder for Project OS"
$dialog.ShowNewFolderButton = $false
$desktop = [Environment]::GetFolderPath('Desktop')
$codePath = Join-Path $desktop "Code"
if (Test-Path $codePath) {
    $dialog.SelectedPath = $codePath
} else {
    $dialog.SelectedPath = $desktop
}
$result = $dialog.ShowDialog()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
    Write-Output $dialog.SelectedPath
} else {
    Write-Output "CANCELLED"
}
`;

    const encodedCommand = Buffer.from(psScript, 'utf16le').toString('base64');
    exec(`powershell -NoProfile -NonInteractive -EncodedCommand ${encodedCommand}`, (error, stdout) => {
      if (error) {
        console.error('Folder picker error:', error);
        resolve(null);
        return;
      }
      const trimmed = stdout.trim();
      if (!trimmed || trimmed === 'CANCELLED') {
        resolve(null);
      } else {
        resolve(trimmed);
      }
    });
  });
}
