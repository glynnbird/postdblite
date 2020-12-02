// create table
const prepareCreateTableSQL = (databaseName) => {
  return `CREATE TABLE ${databaseName} (json TEXT, id TEXT PRIMARY KEY NOT NULL,deleted BOOLEAN NOT NULL DEFAULT false, seq INTEGER KEY NOT NULL DEFAULT 1)`
}

// drop table
const prepareDropTableSQL = (databaseName) => {
  return `DROP TABLE ${databaseName}`
}

// table list
const prepareTableListSQL = () => {
  return 'SELECT * FROM sqlite_master where type=\'table\''
}

// doc count
const prepareTableRowCountSQL = (databaseName) => {
  return `SELECT COUNT(*) as c from ${databaseName} WHERE deleted=FALSE`
}

// deleted doc count
const prepareTableDeletedRowCountSQL = (databaseName) => {
  return `SELECT COUNT(*) as c from ${databaseName} WHERE deleted=TRUE`
}

module.exports = {
  prepareCreateTableSQL,
  prepareDropTableSQL,
  prepareTableListSQL,
  prepareTableRowCountSQL,
  prepareTableDeletedRowCountSQL
}
