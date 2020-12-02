// prepare SQL statement
const prepareInsertSQL = (databaseName) => {
  return `INSERT INTO ${databaseName} (json, id, deleted, seq) VALUES (@json, @id , false, ifnull((SELECT MAX(seq) FROM ${databaseName})+1,1)) ON CONFLICT (id) DO UPDATE SET json = @json,seq = ifnull((SELECT MAX(seq) FROM ${databaseName})+1,1) WHERE id = @id`
}

// delete SQL
const prepareDeleteSQL = (databaseName, id, clusterid) => {
  return `UPDATE ${databaseName} SET deleted=TRUE,json='',seq=ifnull((SELECT MAX(seq) FROM ${databaseName})+1,1) WHERE id=?`
}

// get SQL
const prepareGetSQL = (databaseName, id) => {
  return `SELECT * FROM ${databaseName} WHERE id = ? AND DELETED=false`
}

// process result doc
const processResultDoc = (row) => {
  const doc = typeof row.json === 'string' ? JSON.parse(row.json) : row.json
  doc._id = row.id
  doc._rev = '0-1'
  return doc
}

module.exports = {
  prepareInsertSQL,
  prepareDeleteSQL,
  prepareGetSQL,
  processResultDoc
}
