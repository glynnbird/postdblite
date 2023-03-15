module.exports = function (app, options, done) {
  // DELETE /db/doc
  // delete a doc with a known id
  app.delete('/:db/:id', async (req, reply) => {
    const databaseName = req.params.db
    if (!app.utils.validDatabaseName(databaseName)) {
      return app.sendError(reply, 400, 'Invalid database name')
    }
    const id = req.params.id
    if (!app.utils.validID(id)) {
      return app.sendError(reply, 400, 'Invalid id')
    }
    try {
      const sql = app.docutils.prepareDeleteSQL(databaseName)
      const stmt = app.client.prepare(sql)
      app.debug(sql, id)
      await stmt.run({ id, seq: app.kuuid.prefixms() + app.counter++ })
      reply.send({ ok: true, id, rev: app.fixrev })
    } catch (e) {
      app.debug(e)
      app.sendError(reply, 404, 'Could not delete document ' + databaseName + '/' + id)
    }
  })

  done()
}
