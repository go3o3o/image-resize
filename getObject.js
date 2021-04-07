const request = require('got')
const fileType = require('file-type')

const getObject = async ({ Key }) => {
  if (/^data:/.test(Key)) {
    const data = Key.replace(/^data:image\/\w+;base64,/, '')
    const Body = Buffer.from(data, 'base64')

    return { Body }
  }

  // retrieve remote data
  const { rawBody: Body } = await request(Key)

  return { Body }
}

module.exports = getObject
