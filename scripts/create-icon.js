const fs = require('fs');
const path = require('path');

// Create a simple 256x256 ICO file with multiple resolutions
// This is a basic implementation - for production, use proper tools

const sizes = [16, 32, 48, 64, 128, 256];
const iconData = Buffer.alloc(0);

// ICO file header (6 bytes)
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // Reserved
header.writeUInt16LE(1, 2); // Type (1 = ICO)
header.writeUInt16LE(sizes.length, 4); // Number of images

// For now, just copy the existing icon
const sourceIcon = path.join(__dirname, '../public/icon.ico');
const targetIcon = path.join(__dirname, '../public/icon_new.ico');

if (fs.existsSync(sourceIcon)) {
  fs.copyFileSync(sourceIcon, targetIcon);
  console.log('Icon copied to icon_new.ico');
} else {
  console.log('Source icon not found');
}
