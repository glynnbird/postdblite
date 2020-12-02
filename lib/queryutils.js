// powers _all_docs
const prepareAllDocsSQL = (databaseName) => {
  return `SELECT * FROM ${databaseName} WHERE deleted=FALSE AND id > @startkey AND id <= @endkey LIMIT @limit OFFSET @offset`
}

// powers _changes
const prepareChangesSQL = (databaseName) => {
  return `SELECT * FROM ${databaseName} WHERE seq > ? ORDER BY seq LIMIT ?`
}

module.exports = {
  prepareAllDocsSQL,
  prepareChangesSQL
}
