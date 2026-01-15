<?php
// Test MySQL connection
$host = '127.0.0.1';
$port = 3306;
$user = 'root';
$password = '';
$database = '';

try {
    $dsn = "mysql:host=$host;port=$port;charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    
    echo "✅ Connected to MySQL successfully!\n";
    
    // Show users
    $stmt = $pdo->query("SELECT User, Host FROM mysql.user");
    echo "\n📋 Users:\n";
    while ($row = $stmt->fetch()) {
        echo "- {$row['User']}@{$row['Host']}\n";
    }
    
} catch (PDOException $e) {
    echo "❌ Connection failed: " . $e->getMessage() . "\n";
    
    // Try with password 'root'
    echo "\n🔄 Trying with password 'root'...\n";
    try {
        $pdo = new PDO($dsn, $user, 'root', [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        ]);
        echo "✅ Connected with password 'root'!\n";
    } catch (PDOException $e2) {
        echo "❌ Still failed: " . $e2->getMessage() . "\n";
    }
}
?>
