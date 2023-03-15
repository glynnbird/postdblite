module.exports = function (app, options, done) {
  // GET /db
  // get info on database (table)
  app.get('/:db', async (req, reply) => {
    const databaseName = req.params.db
    if (!app.utils.validDatabaseName(databaseName)) {
      return app.sendError(reply, 400, 'Invalid database name')
    }
    app.debug('Get database info - ' + databaseName)
    try {
      // doc count
      let sql = app.tableutils.prepareTableRowCountSQL(databaseName)
      let stmt = app.client.prepare(sql)
      const databaseCount = await stmt.get()

      // deleted doc count
      sql = app.tableutils.prepareTableDeletedRowCountSQL(databaseName)
      stmt = app.client.prepare(sql)
      const databaseDelCount = await stmt.get()

      // latest seq
      sql = app.tableutils.prepareTableLatestSeqSQL(databaseName)
      stmt = app.client.prepare(sql)
      const databaseLatestSeq = await stmt.get()

      // output object
      const obj = {
        update_seq: databaseLatestSeq.seq || '0',
        sizes: {
          file: 0,
          external: 0,
          active: 0
        },
        props: {},
        disk_format_version: 8,
        compact_running: false,
        cluster: {
          q: 1,
          n: 1,
          w: 1,
          r: 1
        },
        db_name: databaseName,
        instance_start_time: '0',
        doc_count: databaseCount.c,
        doc_del_count: databaseDelCount.c
      }
      reply.send(obj)
    } catch (e) {
      app.debug('error', e)
      app.sendError(reply, 404, 'Could not get database info for ' + databaseName)
    }
  })

  done()
}
