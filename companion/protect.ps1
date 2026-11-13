param([ValidateSet('protect','unprotect')][string]$Operation, [string]$StoreDirectory)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
if ($StoreDirectory) {
  # This directory belongs only to this app. Never modify parent directory ACLs.
  $ownerSid = [Security.Principal.WindowsIdentity]::GetCurrent().User
  $systemSid = New-Object Security.Principal.SecurityIdentifier('S-1-5-18')
  $acl = New-Object Security.AccessControl.DirectorySecurity
  $acl.SetOwner($ownerSid)
  $acl.SetAccessRuleProtection($true, $false)
  foreach ($sid in @($ownerSid, $systemSid)) {
    $rule = New-Object Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
    $acl.AddAccessRule($rule)
  }
  [IO.Directory]::SetAccessControl($StoreDirectory, $acl)
}
$inputText = [Console]::In.ReadToEnd()
$scope = [System.Security.Cryptography.DataProtectionScope]::CurrentUser
if ($Operation -eq 'protect') {
  $plainBytes = [Text.Encoding]::UTF8.GetBytes($inputText)
  $protectedBytes = [Security.Cryptography.ProtectedData]::Protect($plainBytes, $null, $scope)
  [Console]::Out.Write([Convert]::ToBase64String($protectedBytes))
} else {
  $protectedBytes = [Convert]::FromBase64String($inputText)
  $plainBytes = [Security.Cryptography.ProtectedData]::Unprotect($protectedBytes, $null, $scope)
  [Console]::Out.Write([Text.Encoding]::UTF8.GetString($plainBytes))
}
