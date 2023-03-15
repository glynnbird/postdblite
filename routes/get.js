module.exports = function (app, options, done) {
  // GET /
  // return server information
  app.get('/', (req, reply) => {
    const obj = {
      postDB: 'Welcome',
      pkg: app.pkg.name,
      node: process.version,
      version: app.pkg.version
    }
    reply.send(obj)
  })

  done()
}
