// powers _all_docs
const prepareAllDocsSQL = (databaseName, descending) => {
  let sql = `SELECT * FROM ${databaseName} WHERE deleted=FALSE AND id > @startkey AND id <= @endkey ORDER BY id `
  if (descending) {
    sql += 'DESC'
  }
  sql += ' LIMIT @limit OFFSET @offset'
  return sql
}

// powers _changes
const prepareChangesSQL = (databaseName) => {
  return `SELECT * FROM ${databaseName} WHERE seq > ? ORDER BY seq LIMIT ?`
}

module.exports = {
  prepareAllDocsSQL,
  prepareChangesSQL
}
