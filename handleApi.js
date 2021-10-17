const path = require('path')
const fs = require('fs')

const router = {}

async function importJs (dir = null) {
  if (!dir) {
    dir = './'
  }

  fs.readdirSync(dir).forEach(function (file) {
    const filePath = path.join(dir, file)

    const stat = fs.statSync(filePath)
    if (stat.isDirectory()) {
      importJs(filePath)
    }

    if (stat.isFile()) {
      if (file.match(/^.+\.js$/)) {
        const { route } = require(filePath)
        const { GET } = require(filePath)
        const { POST } = require(filePath)

        const routePath = route || dir

        if (GET || POST) {
          router[routePath] = {}
        } else {
          console.error(`No method on endpoint "${filePath}".`)
          console.warn('Endpoint skipped.')
          return
        }

        if (GET) {
          router[routePath].GET = GET
        }

        if (POST) {
          router[routePath].POST = POST
        }
      }
    }
  })
}

module.exports.apiInit = function () {
  const endpointDir = 'endpoints'
  const endpointsPath = path.join(__dirname, endpointDir)
  importJs(endpointsPath)
}

module.exports.handleApi = async (url, options) => {
  //
  if (router[url]) {
    if (options.method === 'GET' || options.method === 'POST') {
      if (router[url][options.method]) {
        if (options.method === 'GET') { return router[url][options.method](options.args) } else return router[url][options.method](options.data)
      } else {
        console.error(
          `No such method (${options.method}) for endpoint "${url}".`
        )
      }
    } else {
      console.error(`Unsupported method: (${options.method})`)
    }
  } else {
    console.error(`No such endpoint: "${url}"`)
  }
}
