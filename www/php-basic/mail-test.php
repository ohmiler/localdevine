<?php
// www/mail-test.php
$to = 'test@example.com';
$subject = 'Test Email from LocalDevine';
$message = 'Hello, this is a test email!';
$headers = 'From: test@localdevine.test' . "\r\n" .
           'Reply-To: test@localdevine.test' . "\r\n" .
           'X-Mailer: PHP/' . phpversion();
if (mail($to, $subject, $message, $headers)) {
    echo 'Email sent successfully!';
} else {
    echo 'Failed to send email.';
}
?>