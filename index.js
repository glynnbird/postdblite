// modules and libraries
const defaults = require('./lib/defaults.js')
const app = require('fastify')({ logger: defaults.logging })

// utils
app.decorate('utils', require('./lib/utils.js'))
app.decorate('docutils', require('./lib/docutils.js'))
app.decorate('tableutils', require('./lib/tableutils.js'))
app.decorate('queryutils', require('./lib/queryutils.js'))
app.decorate('pkg', require('./package.json'))
app.decorate('kuuid', require('kuuid'))
app.decorate('counter', 1)

// debug
app.decorate('debug', require('debug')(app.pkg.name))

// fixed rev value - no MVCC here
app.decorate('fixrev', '0-1')

// AUTH middleware
app.register(require('@fastify/basic-auth'), {
  validate: async function validate (username, password, req, reply) {
    if (username !== defaults.username || password !== defaults.password) {
      return new Error('Invalid username or passeword')
    }
  },
  authenticate: { realm: 'postdblite' }
})

// DB Client
const Database = require('better-sqlite3')
app.decorate('client', new Database('post.db', { verbose: app.debug }))

// send error
app.decorate('sendError', (reply, statusCode, str) => {
  let error = 'error'
  switch (statusCode) {
    case 404: error = 'not_found'; str = 'missing'; break
  }
  reply.status(statusCode).send({ error, reason: str })
})

// write a document to the database
app.decorate('writeDoc', async (databaseName, id, doc) => {
  app.debug('Add document ' + id + ' to database - ' + databaseName)
  const sql = app.docutils.prepareInsertSQL(databaseName)
  app.debug(sql, id, doc)
  const stmt = app.client.prepare(sql)
  return stmt.run({ json: JSON.stringify(doc), id, seq: app.kuuid.prefixms() + app.counter++ })
})

app.after(() => {
  if (defaults.username && defaults.password) {
    app.addHook('onRequest', app.basicAuth)
  }

  app.register(require('./routes/post_session.js'))
  app.register(require('./routes/post_revs_diff.js'))
  app.register(require('./routes/post_ensure_full_commit.js'))
  app.register(require('./routes/post_db_bulk_docs.js'))
  app.register(require('./routes/get_all_dbs.js'))
  app.register(require('./routes/get_uuids.js'))
  app.register(require('./routes/get_db_changes.js'))
  app.register(require('./routes/get_db_all_docs.js'))
  app.register(require('./routes/get_db_local_id.js'))
  app.register(require('./routes/get_db_id.js'))
  app.register(require('./routes/put_db_local_id.js'))
  app.register(require('./routes/put_db_id.js'))
  app.register(require('./routes/delete_db_id.js'))
  app.register(require('./routes/post_db.js'))
  app.register(require('./routes/put_db.js'))
  app.register(require('./routes/delete_db.js'))
  app.register(require('./routes/get_db.js'))
  app.register(require('./routes/get.js'))
})

const main = async () => {
  try {
    await app.listen({ port: defaults.port })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

main()
