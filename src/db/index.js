const promise = require('bluebird');

const options = {
  promiseLib: promise,
};

const pgp = require('pg-promise')(options);

pgp.pg.defaults.poolSize = 20;

const connectionOptions = {
  host: 'localhost',
  port: 5432,
  database: 'docker',
  user: 'docker',
  password: 'docker',
};

const db = pgp(connectionOptions);


module.exports = db;
