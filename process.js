const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'icons', 'ranks');

async function main() {
    console.log('Starting background removal for 3D sprites...');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));
    
    for (const file of files) {
        console.log(`Processing ${file}...`);
        const imgPath = path.join(dir, file);
        const image = await Jimp.read(imgPath);
        
        image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
            const r = this.bitmap.data[idx + 0];
            const g = this.bitmap.data[idx + 1];
            const b = this.bitmap.data[idx + 2];
            
            // Calculate luminance to find the faint dark-grey AI background
            const lum = (0.299 * r + 0.587 * g + 0.114 * b);
            
            // If pixel is extremely dark (background is usually around RGB 10-15)
            if (lum < 20 && r < 30 && g < 30 && b < 30) {
                this.bitmap.data[idx + 3] = 0; // Alpha 0 (transparent)
            } else if (lum < 40 && r < 50 && g < 50 && b < 50) {
                // Feather the very edge for anti-aliasing
                const alpha = Math.max(0, Math.min(255, (lum - 20) * (255 / 20)));
                this.bitmap.data[idx + 3] = alpha;
            }
        });
        
        await image.writeAsync(imgPath);
        console.log(`Finished ${file}`);
    }
    console.log('All backgrounds sliced successfully. Ready for 3D Tilt deployment.');
}

main().catch(console.error);
