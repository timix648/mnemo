# Mnemo Week 1 — seed a test user via docker exec.
# Bypasses node/pg entirely.

$userId  = [guid]::NewGuid().ToString()
$nsId    = [guid]::NewGuid().ToString()
$suiAddr = "0x" + (-join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) }))
$nsObj   = "0x" + (-join ((1..64) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) }))
$token   = "test-" + (-join ((1..16) | ForEach-Object { '{0:x}' -f (Get-Random -Max 16) }))

$sql = @"
INSERT INTO users (id, sui_address, proxy_token) VALUES ('$userId', '$suiAddr', '$token');
INSERT INTO namespaces (id, user_id, sui_object_id, name, is_default) VALUES ('$nsId', '$userId', '$nsObj', 'main', true);
"@

$sql | docker exec -i mnemo_postgres psql -U mnemo_user -d mnemo_db

Write-Host ""
Write-Host "=========================================="
Write-Host "Seeded test user:"
Write-Host "  user_id     : $userId"
Write-Host "  proxy_token : $token"
Write-Host "  namespace_id: $nsId"
Write-Host "=========================================="
Write-Host ""
Write-Host "Save the user_id and proxy_token. You'll need them for the proxy test."