module.exports = function (app, options, done) {
  // DELETE /db
  // delete a database (table)
  app.delete('/:db', async (req, reply) => {
    const databaseName = req.params.db
    if (!app.utils.validDatabaseName(databaseName)) {
      return app.sendError(reply, 400, 'Invalid database name')
    }
    app.debug('Delete database - ' + databaseName)
    try {
      const sql = app.tableutils.prepareDropTableSQL(databaseName)
      app.debug(sql)
      await app.client.exec(sql)
      reply.send({ ok: true })
    } catch (e) {
      app.debug(e)
      app.sendError(reply, 404, 'Could not drop database ' + databaseName)
    }
  })

  done()
}
