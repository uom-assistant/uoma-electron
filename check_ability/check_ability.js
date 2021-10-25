const META = require('../uoma_meta.js')

module.exports = {
  route: 'check_ability/',
  handle: async function (args) {
    if (args.token !== undefined) {
      return new Promise((resolve) => {
        resolve({
          success: true,
          uomabVersion: META.version,
          maintainence: META.maintaining,
          data: {
            tokenRequired: false,
            allowAccount: true,
            allowEmail: true,
            welcomeMessage: 'welcome to electron uoma'
          }
        })
      })
    }
  }
}
