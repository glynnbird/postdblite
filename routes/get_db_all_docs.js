module.exports = function (app, options, done) {
  // GET /db/_all_docs
  // get all documents
  app.get('/:db/_all_docs', async (req, reply) => {
    const databaseName = req.params.db
    const includeDocs = req.query.include_docs === 'true'
    const descending = req.query.descending === 'true'
    let startkey, endkey, limit, offset

    try {
      startkey = req.query.startkey ? JSON.parse(req.query.startkey) : '\u0000'
      endkey = req.query.endkey ? JSON.parse(req.query.endkey) : '\uffff'
      limit = req.query.limit ? JSON.parse(req.query.limit) : 100
      offset = req.query.offset ? JSON.parse(req.query.offset) : 0
    } catch (e) {
      return app.sendError(reply, 400, 'Invalid startkey/endkey/limit/offset parameters')
    }

    // check limit parameter
    if (limit && (typeof limit !== 'number' || limit < 1)) {
      return app.sendError(reply, 400, 'Invalid limit parameter')
    }

    // offset parameter
    if (offset && (typeof offset !== 'number' || offset < 0)) {
      return app.sendError(reply, 400, 'Invalid offset parameter')
    }

    // const offset = 0
    const sql = app.queryutils.prepareAllDocsSQL(databaseName, descending)
    try {
      app.debug(sql.sql, sql.values)
      const stmt = app.client.prepare(sql)
      const data = await stmt.all({ startkey, endkey, limit, offset })
      const obj = {
        rows: []
      }
      for (const i in data) {
        const row = data[i]
        const doc = row.json ? JSON.parse(row.json) : {}
        doc._id = row.id
        doc._rev = app.fixrev
        const thisobj = { id: row.id, key: row.id, value: { rev: app.fixrev } }
        if (includeDocs) {
          thisobj.doc = app.docutils.processResultDoc(row)
        }
        obj.rows.push(thisobj)
      }
      reply.send(obj)
    } catch (e) {
      app.sendError(reply, 404, 'Could not retrieve documents')
    }
  })

  done()
}
