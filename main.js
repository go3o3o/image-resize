const fs = require('fs')
const { handler } = require('./index')

const data = fs.readFileSync('./data.json', 'utf-8')
var rawBody = handler(JSON.parse(data), undefined)

rawBody.then((data) => {
  var rawBody = data.body

  var base64Data = rawBody.replace(/^data:image\/png;base64,/, '')
  fs.writeFile('out.png', base64Data, 'base64', function (err) {
    console.log(err)
  })
})
