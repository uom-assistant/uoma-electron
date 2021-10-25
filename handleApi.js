// const path = require('path')
// const fs = require('fs')

const META = require('./uoma_meta')

const gradeAttendance = require('./grade_attendance/grades')
const checkAbility = require('./check_ability/check_ability')

const endpoints = {
  gradeAttendance,
  checkAbility
}

const router = {}

function trimSlashes (str) {
  if (typeof str === 'string') {
    let result = str
    if (result.charAt(0) === '/') {
      result = result.slice(1)
    }

    if (result.charAt(result.length - 1) === '/') {
      result = result.slice(0, str.length - 1)
    }

    return result
  } else {
    return str
  }
}

module.exports.apiInit = function () {
  for (const ep in endpoints) {
    const endpoint = endpoints[ep]
    router[trimSlashes(endpoint.route)] = endpoint.handle
  }
}

module.exports.handleApi = async (url, options) => {
  return new Promise((resolve, reject) => {
    let args = JSON.parse(options)
    if (!args) {
      args = options
      console.warn('Request data is not a JSON object')
    }
    let data = null
    let error = null

    url = trimSlashes(url)
    if (router[url]) {
      router[url](args).then(
        response => {
          data = JSON.stringify(response)

          const res = {
            success: true,
            status: 200,
            uomabVersion: META.version,
            maintainence: META.maintaining,
            data: data,
            reason: error
          }
          resolve(res)
        }
      ).catch(err => {
        error = err.message
        const res = {
          success: false,
          status: 200,
          uomabVersion: META.version,
          maintainence: META.maintaining,
          data: data,
          reason: error
        }
        resolve(res)
      })
    } else {
      const res = {
        success: false,
        status: 404,
        uomabVersion: META.version,
        maintainence: META.maintaining,
        data: null,
        reason: `UoMAB Error: no such endpoint: ${url}`
      }
      reject(res)
    }
  })
}
