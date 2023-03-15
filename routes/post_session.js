module.exports = function (app, options, done) {
  // POST /_session
  // session endpoint
  app.post('/_session', async (req, reply) => {
    reply.send({ ok: true, name: 'admin', roles: ['admin'] })
  })

  done()
}
