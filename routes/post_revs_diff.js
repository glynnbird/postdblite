module.exports = function (app, options, done) {
  // POST /db/_revs_diff
  // checks if we have doc revisions
  app.post('/:db/_revs_diff', async (req, reply) => {
    const databaseName = req.params.db
    if (!app.utils.validDatabaseName(databaseName)) {
      return app.sendError(reply, 400, 'Invalid database name')
    }

    // simulate response asking for only the most recent revision
    const response = {}
    for (const id in req.body) {
      const revs = req.body[id].sort()
      response[id] = {
        missing: [revs[revs.length - 1]]
      }
    }

    // send response
    reply.send(response)
  })

  done()
}
