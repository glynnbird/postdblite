module.exports = function (app, options, done) {
  // POST /db/_bulk_docs
  // bulk add/update/delete several documents
  app.post('/:db/_bulk_docs', async (req, reply) => {
    const databaseName = req.params.db
    if (!app.utils.validDatabaseName(databaseName)) {
      return app.sendError(reply, 400, 'Invalid database name')
    }

    // docs parameter
    const docs = req.body.docs
    if (!docs || !Array.isArray(req.body.docs) || docs.length === 0) {
      return app.sendError(reply, 400, 'Invalid docs parameter')
    }

    // start transaction
    const response = []

    // process each document
    let sql = app.docutils.prepareInsertSQL(databaseName)
    const insertStmt = app.client.prepare(sql)
    sql = app.docutils.prepareDeleteSQL(databaseName)
    const deleteStmt = app.client.prepare(sql)
    const bulker = app.client.transaction((docs) => {
      for (const i in docs) {
        const doc = docs[i]
        delete doc._revisions
        const id = doc._id ? doc._id : app.kuuid.id()
        delete doc._id
        delete doc._rev
        if (doc._deleted) {
          deleteStmt.run({ id, seq: app.kuuid.prefixms() + app.counter++ })
        } else {
          insertStmt.run({ json: JSON.stringify(doc), id, seq: app.kuuid.prefixms() + app.counter++ })
        }
      }
    })
    await bulker(docs)

    // end transaction
    reply.status(201).send(response)
  })

  done()
}
