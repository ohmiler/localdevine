<?php
function calculate($price, $quantity, $discount = 0) {
    $subtotal = $price * $quantity;        // Set breakpoint ที่นี่
    $discountAmount = $subtotal * $discount; // ดูค่า $subtotal ก่อน
    $total = $subtotal - $discountAmount;   // ดูค่า $discountAmount
    return $total;                          // ดูค่าสุดท้าย
}
$price = 100;
$quantity = 3;
$result = calculate($price, $quantity, 0.1);
echo "Total: " . $result;
?>