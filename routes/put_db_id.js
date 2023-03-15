module.exports = function (app, options, done) {
  // PUT /db/doc
  // add a doc with a known id
  app.put('/:db/:id', async (req, reply) => {
    const databaseName = req.params.db
    if (!app.utils.validDatabaseName(databaseName)) {
      return app.sendError(reply, 400, 'Invalid database name')
    }
    const id = req.params.id
    if (!app.utils.validID(id)) {
      return app.sendError(reply, 400, 'Invalid id')
    }
    const doc = req.body
    if (!doc || typeof doc !== 'object') {
      return app.sendError(reply, 400, 'Invalid JSON')
    }
    try {
      await app.writeDoc(databaseName, id, doc)
      reply.status(201).send({ ok: true, id, rev: app.fixrev })
    } catch (e) {
      app.debug(e)
      app.sendError(reply, 404, 'Could not write document ' + id)
    }
  })

  done()
}
