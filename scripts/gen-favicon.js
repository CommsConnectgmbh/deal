const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

async function run() {
  const src = path.join(__dirname, '..', 'public', 'logo.png')
  const meta = await sharp(src).metadata()

  // Crop handshake region (top ~42% of the logo, slightly inset sideways)
  const handshake = await sharp(src)
    .extract({ left: 230, top: 220, width: 560, height: 290 })
    .resize({ width: 400, height: 400, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer()

  // Build a black rounded-square canvas 512x512, centered handshake
  const size = 512
  const radius = 96
  const svgBg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
       <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#000"/>
     </svg>`
  )

  const composed = await sharp(svgBg)
    .composite([{ input: handshake, gravity: 'center' }])
    .png()
    .toBuffer()

  // Write favicon PNG variants
  await sharp(composed).resize(512, 512).toFile(path.join(__dirname, '..', 'public', 'favicon-512.png'))
  await sharp(composed).resize(192, 192).toFile(path.join(__dirname, '..', 'public', 'favicon-192.png'))
  await sharp(composed).resize(32, 32).toFile(path.join(__dirname, '..', 'public', 'favicon-32.png'))
  await sharp(composed).resize(16, 16).toFile(path.join(__dirname, '..', 'public', 'favicon-16.png'))

  console.log('Generated favicon variants in public/')
}

run().catch(e => { console.error(e); process.exit(1) })
