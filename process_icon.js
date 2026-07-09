const { Jimp } = require('jimp');

async function processIcon() {
  try {
    const image = await Jimp.read('frontend/app/icon.png');
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
      const red = this.bitmap.data[idx + 0];
      const green = this.bitmap.data[idx + 1];
      const blue = this.bitmap.data[idx + 2];
      
      // If the pixel is close to white, make it transparent
      if (red > 240 && green > 240 && blue > 240) {
        this.bitmap.data[idx + 3] = 0; // Alpha channel
      }
    });
    await image.write('frontend/app/icon.png');
    console.log('Icon processed: White background removed.');
  } catch (err) {
    console.error('Error processing icon:', err);
  }
}

processIcon();
