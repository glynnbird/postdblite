module.exports = function (app, options, done) {
  // GET /db/_all_dbs
  // get a list of unique ids
  app.get('/_uuids', (req, reply) => {
    const count = req.query.count ? JSON.parse(req.query.count) : 1
    if (count < 1 || count > 100) {
      return app.sendError(reply, 400, 'invalid count parameter')
    }
    const obj = {
      uuids: []
    }
    for (let i = 0; i < count; i++) {
      obj.uuids.push(app.kuuid.id())
    }
    reply.send(obj)
  })

  done()
}
