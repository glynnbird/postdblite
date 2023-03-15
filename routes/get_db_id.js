module.exports = function (app, options, done) {
  // GET /db/doc
  // get a doc with a known id
  app.get('/:db/:id', async (req, reply) => {
    const databaseName = req.params.db
    if (!app.utils.validDatabaseName(databaseName)) {
      return app.sendError(reply, 400, 'Invalid database name')
    }
    const id = req.params.id
    if (!app.utils.validID(id)) {
      return app.sendError(reply, 400, 'Invalid id')
    }
    try {
      const sql = app.docutils.prepareGetSQL(databaseName)
      app.debug(sql)
      const stmt = app.client.prepare(sql)
      const data = await stmt.get(id)
      if (!data) {
        throw (new Error('missing document'))
      }
      const doc = app.docutils.processResultDoc(data)
      if (req.query.revs) {
        doc._revisions = {
          start: 1,
          ids: [app.fixrev]
        }
      }
      reply.send(doc)
    } catch (e) {
      app.sendError(reply, 404, 'Document not found ' + id)
    }
  })

  done()
}
