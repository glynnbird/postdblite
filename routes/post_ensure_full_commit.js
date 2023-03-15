module.exports = function (app, options, done) {
  // POST /db/_ensure_full_commit
  // checks if we have doc revisions
  app.post('/:db/_ensure_full_commit', async (req, reply) => {
    const databaseName = req.params.db
    if (!app.utils.validDatabaseName(databaseName)) {
      return app.sendError(reply, 400, 'Invalid database name')
    }

    // simulate response asking for only the most recent revision
    const response = {
      instance_start_time: '0',
      ok: true
    }

    // send response
    reply.status(201).send(response)
  })

  done()
}
