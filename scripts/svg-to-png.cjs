const sharp = require("sharp");
const path = require("path");

const INPUT = path.resolve(__dirname, "../public/icons/icon.svg");
const OUTPUT_DIR = path.resolve(__dirname, "../public/icons");
const SIZES = [16, 32, 48, 128];

async function main() {
  for (const size of SIZES) {
    const output = path.join(OUTPUT_DIR, `icon-${size}.png`);
    await sharp(INPUT).resize(size, size).png().toFile(output);
    console.log(`Created: icon-${size}.png (${size}x${size})`);
  }
  console.log("Done!");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
