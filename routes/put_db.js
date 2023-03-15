module.exports = function (app, options, done) {
  // PUT /db
  // create a database
  app.put('/:db', async (req, reply) => {
    const databaseName = req.params.db
    if (!app.utils.validDatabaseName(databaseName)) {
      return app.sendError(reply, 400, 'Invalid database name')
    }
    app.debug('Creating database - ' + databaseName)
    try {
      const sql = app.tableutils.prepareCreateTableSQL(databaseName)
      await app.client.exec(sql)
      reply.status(201).send({ ok: true })
    } catch (e) {
      app.sendError(reply, 400, 'Could not create database' + databaseName)
    }
  })

  done()
}
