const promise = require('bluebird');

const options = {
  promiseLib: promise,
};

const pgp = require('pg-promise')(options);

const db = pgp('postgres://postgres:root@localhost:5432/forum');

module.exports = db;
