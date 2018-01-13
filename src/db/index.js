const promise = require('bluebird');

const options = {
  promiseLib: promise,
};

const pgp = require('pg-promise')(options);

const connectionOptions = {
  host: 'localhost',
  port: 5432,
  database: 'docker',
  user: 'docker',
  password: 'docker',
  poolSize: 8,
};

const db = pgp(connectionOptions);

module.exports = db;
