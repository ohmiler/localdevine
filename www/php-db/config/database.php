<?php
/**
 * Database Configuration
 * php-db
 */

class Database {
    private static $instance = null;
    private $connection;
    
    private $host = '127.0.0.1';
    private $port = 3306;
    private $username = 'root';
    private $password = 'root';
    private $database = 'php_db';
    
    private function __construct() {
        try {
            $this->connection = new mysqli(
                $this->host,
                $this->username,
                $this->password,
                $this->database,
                $this->port
            );
            
            if ($this->connection->connect_error) {
                throw new Exception("Connection failed: " . $this->connection->connect_error);
            }
            
            $this->connection->set_charset("utf8mb4");
        } catch (Exception $e) {
            die("Database Error: " . $e->getMessage());
        }
    }
    
    public static function getInstance(): Database {
        if (self::$instance === null) {
            self::$instance = new Database();
        }
        return self::$instance;
    }
    
    public function getConnection(): mysqli {
        return $this->connection;
    }
    
    public function query(string $sql): mysqli_result|bool {
        return $this->connection->query($sql);
    }
    
    public function prepare(string $sql): mysqli_stmt|false {
        return $this->connection->prepare($sql);
    }
    
    public function escape(string $value): string {
        return $this->connection->real_escape_string($value);
    }
    
    public function lastInsertId(): int {
        return $this->connection->insert_id;
    }
    
    public function close(): void {
        $this->connection->close();
    }
}