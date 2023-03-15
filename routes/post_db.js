module.exports = function (app, options, done) {
  // POST /db
  // add a doc without an id
  app.post('/:db', async (req, reply) => {
    const databaseName = req.params.db
    if (!app.utils.validDatabaseName(databaseName)) {
      return app.sendError(reply, 400, 'Invalid database name')
    }
    const id = app.kuuid.id()
    const doc = req.body
    try {
      await app.writeDoc(databaseName, id, doc)
      reply.status(201).send({ ok: true, id, rev: app.fixrev })
    } catch (e) {
      app.debug(e)
      app.sendError(reply, 400, 'Could not save document')
    }
  })

  done()
}
