const sharp = require('sharp')

const generalResize = async ({ Body, options, originalFormat, requiredFormat, maxSize }) => {
  const { width, height } = options

  let resizedImage
  let metadata
  let quality = 100
  let bufferByteLength = 0
  let buffer

  resizedImage = await sharp(Body)
  metadata = await resizedImage.metadata()

  while (true) {
    console.log(width, height)
    if ((width !== undefined && metadata.width > width) || (height !== undefined && metadata.height > height)) {
      resizedImage = resizedImage.resize({ width, height }).withMetadata()
    }

    if (bufferByteLength > maxSize || originalFormat !== requiredFormat) {
      resizedImage = resizedImage.toFormat(requiredFormat)
    }
    buffer = await resizedImage.toBuffer()
    bufferByteLength = Buffer.byteLength(buffer, 'base64')
    console.log(bufferByteLength)

    if (bufferByteLength >= maxSize) {
      quality -= 10
      if (quality <= 60 || requiredFormat !== 'jpeg') {
        throw new Error(`Big size image(format: ${originalFormat}, size: ${bufferByteLength} byte)`)
      }

      if (requiredFormat === 'jpeg') {
        resizedImage = await resizedImage.jpeg({ quality: quality })
      }
    } else {
      break
    }
  }

  return buffer
}

module.exports = generalResize
