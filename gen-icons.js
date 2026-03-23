// Run once with Node to generate icon PNGs
// node gen-icons.js
const { createCanvas } = require('canvas');
const fs = require('fs');

function generateIcon(size, filename) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#6366f1');
  grad.addColorStop(1, '#4f46e5');
  ctx.fillStyle = grad;
  ctx.roundRect(0, 0, size, size, size * 0.22);
  ctx.fill();

  // Dollar sign
  ctx.fillStyle = 'white';
  ctx.font = `bold ${size * 0.52}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', size / 2, size / 2);

  fs.writeFileSync(filename, canvas.toBuffer('image/png'));
  console.log('Generated', filename);
}

generateIcon(192, 'icon-192.png');
generateIcon(512, 'icon-512.png');
