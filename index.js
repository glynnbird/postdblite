// modules and libraries
const app = require('fastify')({ logger: true })
const utils = require('./lib/utils.js')
const docutils = require('./lib/docutils.js')
const tableutils = require('./lib/tableutils.js')
const queryutils = require('./lib/queryutils.js')
const pkg = require('./package.json')
const debug = require('debug')(pkg.name)
// const app = express()
// const basicAuth = require('express-basic-auth')
const kuuid = require('kuuid')
// const morgan = require('morgan')
let counter = 1

// fixed rev value - no MVCC here
const fixrev = '0-1'

// incoming environment variables vs defaults
const defaults = require('./lib/defaults.js')

// pretty print
// app.set('json spaces', 2)
// app.set('x-powered-by', false)

// JSON parsing middleware
// const bodyParser = require('body-parser')
// app.use(bodyParser.json({ limit: '10mb' }))

// compression middleware
// const compression = require('compression')
// app.use(compression())

// Logging middleware
/* if (defaults.logging !== 'none') {
  app.use(morgan(defaults.logging))
} */

// AUTH middleware
/* if (defaults.username && defaults.password) {
  console.log('NOTE: authentication mode')
  const obj = {}
  obj[defaults.username] = defaults.password
  app.use(basicAuth({ users: obj }))
} */

// readonly middleware
// const readOnlyMiddleware = require('./lib/readonly.js')(defaults.readonly)
// if (defaults.readonly) {
//   console.log('NOTE: readonly mode')
// }

// DB Client
const Database = require('better-sqlite3')
const client = new Database('post.db', { verbose: debug })

// send error
const sendError = (reply, statusCode, str) => {
  let error = 'error'
  switch (statusCode) {
    case 404: error = 'not_found'; str = 'missing'; break
  }
  reply.status(statusCode).send({ error, reason: str })
}

// write a document to the database
const writeDoc = async (databaseName, id, doc) => {
  debug('Add document ' + id + ' to database - ' + databaseName)
  const sql = docutils.prepareInsertSQL(databaseName)
  debug(sql, id, doc)
  const stmt = client.prepare(sql)
  return stmt.run({ json: JSON.stringify(doc), id, seq: kuuid.prefixms() + counter++ })
}

// POST /_session
// session endpoint
app.post('/_session', async (req, reply) => {
  reply.send({ ok: true, name: 'admin', roles: ['admin'] })
})

// POST /db/_revs_diff
// checks if we have doc revisions
app.post('/:db/_revs_diff', async (req, reply) => {
  const databaseName = req.params.db
  if (!utils.validDatabaseName(databaseName)) {
    return sendError(reply, 400, 'Invalid database name')
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

// POST /db/_ensure_full_commit
// checks if we have doc revisions
app.post('/:db/_ensure_full_commit', async (req, reply) => {
  const databaseName = req.params.db
  if (!utils.validDatabaseName(databaseName)) {
    return sendError(reply, 400, 'Invalid database name')
  }

  // simulate response asking for only the most recent revision
  const response = {
    instance_start_time: '0',
    ok: true
  }

  // send response
  reply.status(201).send(response)
})

// POST /db/_bulk_docs
// bulk add/update/delete several documents
app.post('/:db/_bulk_docs', async (req, reply) => {
  const databaseName = req.params.db
  if (!utils.validDatabaseName(databaseName)) {
    return sendError(reply, 400, 'Invalid database name')
  }

  // docs parameter
  const docs = req.body.docs
  if (!docs || !Array.isArray(req.body.docs) || docs.length === 0) {
    return sendError(reply, 400, 'Invalid docs parameter')
  }

  // start transaction
  const response = []

  // process each document
  let sql = docutils.prepareInsertSQL(databaseName)
  const insertStmt = client.prepare(sql)
  sql = docutils.prepareDeleteSQL(databaseName)
  const deleteStmt = client.prepare(sql)
  const bulker = client.transaction((docs) => {
    for (const i in docs) {
      const doc = docs[i]
      delete doc._revisions
      const id = doc._id ? doc._id : kuuid.id()
      delete doc._id
      delete doc._rev
      if (doc._deleted) {
        deleteStmt.run({ id, seq: kuuid.prefixms() + counter++ })
      } else {
        insertStmt.run({ json: JSON.stringify(doc), id, seq: kuuid.prefixms() + counter++ })
      }
    }
  })
  await bulker(docs)

  // end transaction
  reply.status(201).send(response)
})

// GET /db/_all_dbs
// get a list of databases (tables)
app.get('/_all_dbs', async (req, reply) => {
  try {
    const sql = tableutils.prepareTableListSQL()
    const stmt = client.prepare(sql)
    debug(sql)
    const data = await stmt.all()
    const databases = []
    for (const i in data) {
      const row = data[i]
      databases.push(row.name)
    }
    reply.send(databases.sort())
  } catch (e) {
    debug(e)
    sendError(reply, 404, 'Could not retrieve databases')
  }
})

// GET /db/_all_dbs
// get a list of unique ids
app.get('/_uuids', (req, reply) => {
  const count = req.query.count ? JSON.parse(req.query.count) : 1
  if (count < 1 || count > 100) {
    return sendError(reply, 400, 'invalid count parameter')
  }
  const obj = {
    uuids: []
  }
  for (let i = 0; i < count; i++) {
    obj.uuids.push(kuuid.id())
  }
  reply.send(obj)
})

// GET /db/changes
// get a list of changes
app.get('/:db/_changes', async (req, reply) => {
  const databaseName = req.params.db
  if (!utils.validDatabaseName(databaseName)) {
    return sendError(reply, 400, 'Invalid database name')
  }

  // parameter munging
  const since = req.query.since ? req.query.since : '0'
  const includeDocs = req.query.include_docs === 'true'
  let limit
  try {
    limit = req.query.limit ? Number.parseInt(req.query.limit) : 100
  } catch (e) {
    return sendError(reply, 400, 'Invalid limit parameter')
  }
  if (limit && (typeof limit !== 'number' || limit < 1)) {
    return sendError(reply, 400, 'Invalid limit parameter')
  }

  // do query
  const sql = queryutils.prepareChangesSQL(databaseName)

  try {
    debug(sql.sql, sql.values)
    const stmt = client.prepare(sql)
    const data = await stmt.all(since, limit)
    const obj = {
      last_seq: '',
      results: []
    }
    let lastSeq = since
    for (const i in data) {
      const row = data[i]
      const thisobj = {
        changes: [{ rev: fixrev }],
        id: row.id,
        seq: row.seq.toString(),
        clusterid: row.clusterid
      }
      if (row.deleted) {
        thisobj.deleted = true
      }
      if (includeDocs) {
        thisobj.doc = docutils.processResultDoc(row)
      }
      lastSeq = row.seq.toString()
      obj.results.push(thisobj)
    }
    obj.last_seq = lastSeq
    reply.send(obj)
  } catch (e) {
    debug(e)
    sendError(reply, 500, 'Could not fetch changes feed')
  }
})

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
    return sendError(reply, 400, 'Invalid startkey/endkey/limit/offset parameters')
  }

  // check limit parameter
  if (limit && (typeof limit !== 'number' || limit < 1)) {
    return sendError(reply, 400, 'Invalid limit parameter')
  }

  // offset parameter
  if (offset && (typeof offset !== 'number' || offset < 0)) {
    return sendError(reply, 400, 'Invalid offset parameter')
  }

  // const offset = 0
  const sql = queryutils.prepareAllDocsSQL(databaseName, descending)
  try {
    debug(sql.sql, sql.values)
    const stmt = client.prepare(sql)
    const data = await stmt.all({ startkey, endkey, limit, offset })
    const obj = {
      rows: []
    }
    for (const i in data) {
      const row = data[i]
      const doc = row.json ? JSON.parse(row.json) : {}
      doc._id = row.id
      doc._rev = fixrev
      const thisobj = { id: row.id, key: row.id, value: { rev: fixrev } }
      if (includeDocs) {
        thisobj.doc = docutils.processResultDoc(row)
      }
      obj.rows.push(thisobj)
    }
    reply.send(obj)
  } catch (e) {
    sendError(reply, 404, 'Could not retrieve documents')
  }
})

// GET /db/_local/doc
// get a doc with a known id
app.get('/:db/_local/:id', async (req, reply) => {
  const databaseName = req.params.db
  if (!utils.validDatabaseName(databaseName)) {
    return sendError(reply, 400, 'Invalid database name')
  }
  let id = req.params.id
  if (!utils.validID(id)) {
    return sendError(reply, 400, 'Invalid id')
  }
  id = '_local/' + id
  try {
    const sql = docutils.prepareGetSQL(databaseName)
    debug(sql)
    const stmt = client.prepare(sql)
    const data = await stmt.get(id)
    if (!data) {
      throw (new Error('missing document'))
    }
    const doc = docutils.processResultDoc(data)
    reply.send(doc)
  } catch (e) {
    sendError(reply, 404, 'Document not found ' + id)
  }
})

// GET /db/doc
// get a doc with a known id
app.get('/:db/:id', async (req, reply) => {
  const databaseName = req.params.db
  if (!utils.validDatabaseName(databaseName)) {
    return sendError(reply, 400, 'Invalid database name')
  }
  const id = req.params.id
  if (!utils.validID(id)) {
    return sendError(reply, 400, 'Invalid id')
  }
  try {
    const sql = docutils.prepareGetSQL(databaseName)
    debug(sql)
    const stmt = client.prepare(sql)
    const data = await stmt.get(id)
    if (!data) {
      throw (new Error('missing document'))
    }
    const doc = docutils.processResultDoc(data)
    if (req.query.revs) {
      doc._revisions = {
        start: 1,
        ids: [fixrev]
      }
    }
    reply.send(doc)
  } catch (e) {
    sendError(reply, 404, 'Document not found ' + id)
  }
})

// PUT /db/_local/doc
// add a doc with a known id
app.put('/:db/_local/:id', async (req, reply) => {
  const databaseName = req.params.db
  if (!utils.validDatabaseName(databaseName)) {
    return sendError(reply, 400, 'Invalid database name')
  }
  let id = req.params.id
  if (!utils.validID(id)) {
    return sendError(reply, 400, 'Invalid id')
  }
  id = '_local/' + id
  const doc = req.body
  if (!doc || typeof doc !== 'object') {
    return sendError(reply, 400, 'Invalid JSON')
  }
  try {
    await writeDoc(databaseName, id, doc)
    reply.status(201).send({ ok: true, id, rev: fixrev })
  } catch (e) {
    debug(e)
    sendError(reply, 404, 'Could not write document ' + id)
  }
})

// PUT /db/doc
// add a doc with a known id
app.put('/:db/:id', async (req, reply) => {
  const databaseName = req.params.db
  if (!utils.validDatabaseName(databaseName)) {
    return sendError(reply, 400, 'Invalid database name')
  }
  const id = req.params.id
  if (!utils.validID(id)) {
    return sendError(reply, 400, 'Invalid id')
  }
  const doc = req.body
  if (!doc || typeof doc !== 'object') {
    return sendError(reply, 400, 'Invalid JSON')
  }
  try {
    await writeDoc(databaseName, id, doc)
    reply.status(201).send({ ok: true, id, rev: fixrev })
  } catch (e) {
    debug(e)
    sendError(reply, 404, 'Could not write document ' + id)
  }
})

// DELETE /db/doc
// delete a doc with a known id
app.delete('/:db/:id', async (req, reply) => {
  const databaseName = req.params.db
  if (!utils.validDatabaseName(databaseName)) {
    return sendError(reply, 400, 'Invalid database name')
  }
  const id = req.params.id
  if (!utils.validID(id)) {
    return sendError(reply, 400, 'Invalid id')
  }
  try {
    const sql = docutils.prepareDeleteSQL(databaseName)
    const stmt = client.prepare(sql)
    debug(sql, id)
    await stmt.run({ id, seq: kuuid.prefixms() + counter++ })
    reply.send({ ok: true, id, rev: fixrev })
  } catch (e) {
    debug(e)
    sendError(reply, 404, 'Could not delete document ' + databaseName + '/' + id)
  }
})

// POST /db
// add a doc without an id
app.post('/:db', async (req, reply) => {
  const databaseName = req.params.db
  if (!utils.validDatabaseName(databaseName)) {
    return sendError(reply, 400, 'Invalid database name')
  }
  const id = kuuid.id()
  const doc = req.body
  try {
    await writeDoc(databaseName, id, doc)
    reply.status(201).send({ ok: true, id, rev: fixrev })
  } catch (e) {
    debug(e)
    sendError(reply, 400, 'Could not save document')
  }
})

// PUT /db
// create a database
app.put('/:db', async (req, reply) => {
  const databaseName = req.params.db
  if (!utils.validDatabaseName(databaseName)) {
    return sendError(reply, 400, 'Invalid database name')
  }
  debug('Creating database - ' + databaseName)
  try {
    const sql = tableutils.prepareCreateTableSQL(databaseName)
    await client.exec(sql)
    reply.status(201).send({ ok: true })
  } catch (e) {
    sendError(reply, 400, 'Could not create database' + databaseName)
  }
})

// DELETE /db
// delete a database (table)
app.delete('/:db', async (req, reply) => {
  const databaseName = req.params.db
  if (!utils.validDatabaseName(databaseName)) {
    return sendError(reply, 400, 'Invalid database name')
  }
  debug('Delete database - ' + databaseName)
  try {
    const sql = tableutils.prepareDropTableSQL(databaseName)
    debug(sql)
    await client.exec(sql)
    reply.send({ ok: true })
  } catch (e) {
    debug(e)
    sendError(reply, 404, 'Could not drop database ' + databaseName)
  }
})

// GET /db
// get info on database (table)
app.get('/:db', async (req, reply) => {
  const databaseName = req.params.db
  if (!utils.validDatabaseName(databaseName)) {
    return sendError(reply, 400, 'Invalid database name')
  }
  debug('Get database info - ' + databaseName)
  try {
    // doc count
    let sql = tableutils.prepareTableRowCountSQL(databaseName)
    let stmt = client.prepare(sql)
    const databaseCount = await stmt.get()

    // deleted doc count
    sql = tableutils.prepareTableDeletedRowCountSQL(databaseName)
    stmt = client.prepare(sql)
    const databaseDelCount = await stmt.get()

    // latest seq
    sql = tableutils.prepareTableLatestSeqSQL(databaseName)
    stmt = client.prepare(sql)
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
    debug('error', e)
    sendError(reply, 404, 'Could not get database info for ' + databaseName)
  }
})

// GET /
// return server information
app.get('/', (req, reply) => {
  const obj = {
    postDB: 'Welcome',
    pkg: pkg.name,
    node: process.version,
    version: pkg.version
  }
  reply.send(obj)
})

// backstop route
// app.use(function (req, res) {
//   res.status(404).send({ error: 'not_found', reason: 'missing' })
// })

const main = async () => {
  try {
    await app.listen({ port: defaults.port })
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

main()
