<?php
/**
 * php-db - PHP + Database Project
 * Created with LocalDevine
 */

require_once 'config/database.php';

// Get database connection
$db = Database::getInstance();
$conn = $db->getConnection();

// Example query
$result = $conn->query("SELECT 1 as test");
$dbStatus = $result ? "Connected" : "Failed";
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>php-db</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
        .container { background: white; padding: 2rem 3rem; border-radius: 1rem; box-shadow: 0 10px 40px rgba(0,0,0,0.2); text-align: center; max-width: 500px; }
        h1 { color: #333; margin-bottom: 1rem; }
        .status { padding: 0.5rem 1rem; border-radius: 0.5rem; margin: 0.5rem 0; }
        .success { background: #d4edda; color: #155724; }
        .info { background: #e2e3e5; color: #383d41; }
        .footer { margin-top: 1.5rem; color: #666; font-size: 0.875rem; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 php-db</h1>
        <p class="status success">✅ Database: <?= $dbStatus ?></p>
        <p class="status info">🐘 PHP Version: <?= phpversion() ?></p>
        <p class="status info">🗄️ Database: php_db</p>
        <p class="status info">⏰ Server Time: <?= date('Y-m-d H:i:s') ?></p>
        <p class="footer">Created with LocalDevine</p>
    </div>
</body>
</html>