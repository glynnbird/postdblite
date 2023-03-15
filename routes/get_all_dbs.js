module.exports = function (app, options, done) {
  // GET /db/_all_dbs
  // get a list of databases (tables)
  app.get('/_all_dbs', async (req, reply) => {
    try {
      const sql = app.tableutils.prepareTableListSQL()
      const stmt = app.client.prepare(sql)
      app.debug(sql)
      const data = await stmt.all()
      const databases = []
      for (const i in data) {
        const row = data[i]
        databases.push(row.name)
      }
      reply.send(databases.sort())
    } catch (e) {
      app.debug(e)
      app.sendError(reply, 404, 'Could not retrieve databases')
    }
  })
  done()
}
