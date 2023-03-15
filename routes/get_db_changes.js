module.exports = function (app, options, done) {
  // GET /db/changes
  // get a list of changes
  app.get('/:db/_changes', async (req, reply) => {
    const databaseName = req.params.db
    if (!app.utils.validDatabaseName(databaseName)) {
      return app.sendError(reply, 400, 'Invalid database name')
    }

    // parameter munging
    const since = req.query.since ? req.query.since : '0'
    const includeDocs = req.query.include_docs === 'true'
    let limit
    try {
      limit = req.query.limit ? Number.parseInt(req.query.limit) : 100
    } catch (e) {
      return app.sendError(reply, 400, 'Invalid limit parameter')
    }
    if (limit && (typeof limit !== 'number' || limit < 1)) {
      return app.sendError(reply, 400, 'Invalid limit parameter')
    }

    // do query
    const sql = app.queryutils.prepareChangesSQL(databaseName)

    try {
      app.debug(sql.sql, sql.values)
      const stmt = app.client.prepare(sql)
      const data = await stmt.all(since, limit)
      const obj = {
        last_seq: '',
        results: []
      }
      let lastSeq = since
      for (const i in data) {
        const row = data[i]
        const thisobj = {
          changes: [{ rev: app.fixrev }],
          id: row.id,
          seq: row.seq.toString(),
          clusterid: row.clusterid
        }
        if (row.deleted) {
          thisobj.deleted = true
        }
        if (includeDocs) {
          thisobj.doc = app.docutils.processResultDoc(row)
        }
        lastSeq = row.seq.toString()
        obj.results.push(thisobj)
      }
      obj.last_seq = lastSeq
      reply.send(obj)
    } catch (e) {
      app.debug(e)
      app.sendError(reply, 500, 'Could not fetch changes feed')
    }
  })

  done()
}
