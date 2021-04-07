'use strict'

const getObject = require('./getObject')
const generalResize = require('./generalResize')

const supportImageTypes = ['jpg', 'jpeg', 'png', 'webp', 'svg', 'tiff']
const maxSize = 1048576 // 1954821
const ttl = 60 * 60 * 24 * 30 * 6

exports.handler = async (event, context, callback) => {
  const { request, response } = event.Records[0].cf
  const { uri } = request

  const opsParser = new RegExp([/\/(?<operation>[^\/]+)/, /\/(?<size>[^\/]+)/, /(?:\/(?<format>[^\/]+))?/, /\/(?<source>.*$)/].map((_) => _.source).join(''), 'si')

  const { groups } = uri.match(opsParser)
  let { operation, size, format, source } = groups

  console.log(`Step #1. Parsing url`)
  console.log(groups)

  /////
  source = request.querystring ? source + '?' + request.querystring : source

  console.log(operation, size, source)

  if (!operation || !size || !source) return callback(null, response)

  const respond = responseUpdate({ response, callback })

  let buffer
  const options = {}

  switch (operation) {
    case 'width':
      options.width = +size
      break
    case 'height':
      options.height = +size
      break
    case 'crop':
      options.fit = 'cover'
      break
    case 'cover':
      options.fit = 'cover'
      break
    case 'fit':
      options.fit = 'contain'
      break
    case 'bound':
      options.fit = 'inside'
      break
    case 'inside':
      options.fit = 'inside'
      break
    case 'outside':
      options.fit = 'outside'
      break
    default:
      options.fit = 'cover'
  }

  if (!options.width && !options.height) {
    const [width, height] = size.split('x').map(Number)
    options.width = width
    options.height = height
  }

  console.log(`Step #2. Make image options`)
  console.log(' ###', options)

  /////
  let originalFormat
  let requiredFormat

  const extensions = `(?<extension>${supportImageTypes.join('|')})`

  const extensionParser = new RegExp([/\./, extensions, /(?:\?[^\?]*)?$/].map((_) => _.source || _).join(''), 'i')

  // const sourceKey = decodeURIComponent(source)
  const sourceKey = source

  originalFormat = sourceKey.match(extensionParser)

  // if (!originalFormat) {
  //   return respond({
  //     status: 302,
  //     statusDescription: 'Found',
  //     headers: { location: [{ key: 'Location', value: source }] },
  //   });
  // }
  originalFormat = originalFormat ? (originalFormat.groups ? originalFormat.groups.extension.toLowerCase() : 'jpeg') : null
  // originalFormat = originalFormat.groups ? originalFormat.groups.extension : 'jpeg'
  // originalFormat = originalFormat ? (originalFormat.groups ? originalFormat.groups.extension : 'jpeg') : 'jpeg'
  // originalFormat = originalFormat.toLowerCase()

  if (!supportImageTypes.includes(originalFormat) || !originalFormat) {
    return respond({
      status: '302',
      statusDescription: 'Found',
      headers: {
        location: [
          {
            key: 'Location',
            value: sourceKey,
          },
        ],
      },
      // headers: { Location: sourceKey },
    })
  }

  originalFormat = originalFormat === 'jpg' ? 'jpeg' : originalFormat
  requiredFormat = format === 'webp' ? 'webp' : originalFormat

  if (!supportImageTypes.includes(requiredFormat)) {
    requiredFormat = 'jpeg'
  }

  console.log(`Step #3. Check image extension format`)
  console.log(' ### ', originalFormat, requiredFormat)

  /////
  let target

  console.log(`Step #4. Get original data from url`)
  console.log(' ### ', sourceKey)
  try {
    target = await getObject({ Key: sourceKey })
  } catch (error) {
    console.log('getObject: ', error)
    return respond({
      status: '302',
      statusDescription: 'Found',
      headers: {
        location: [
          {
            key: 'Location',
            value: source,
          },
        ],
      },
    })
  }

  /////
  console.log(`Step #5. Resize image`)
  try {
    buffer = await generalResize({
      Body: target.Body,
      options,
      originalFormat,
      requiredFormat,
      maxSize,
    })
    console.log(' ### ', buffer)
  } catch (error) {
    console.log('imageResize: ', error)
    return respond({
      status: '302',
      statusDescription: 'Found',
      headers: {
        location: [
          {
            key: 'Location',
            value: source,
          },
        ],
      },
    })
  }

  /////
  console.log(`Step #6. Finished`)
  return respond({
    status: 200,
    body: buffer.toString('base64'),
    contentType: `image/${requiredFormat}`,
    cacheControl: `max-age=${ttl}`,
    bodyEncoding: 'base64',
  })
}

const responseUpdate = ({ response, callback }) => ({ status, statusDescription = 'OK', body, contentType = 'text/plain', cacheControl, bodyEncoding, headers }) => {
  response.status = status
  response.statusDescription = statusDescription

  if (body !== undefined) response.body = body

  if (!headers) {
    response.headers['content-type'] = [
      {
        key: 'Content-Type',
        value: contentType,
      },
    ]

    if (cacheControl)
      response.headers['cache-control'] = [
        {
          key: 'cache-control',
          value: cacheControl,
        },
      ]
    if (bodyEncoding) response.bodyEncoding = bodyEncoding
  } else {
    response.headers = {
      ...response.headers,
      ...headers,
    }
  }

  // console.log(JSON.stringify(response))

  return callback(null, response)
}
