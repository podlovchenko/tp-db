const promise = require('bluebird');

const options = {
  promiseLib: promise,
};

const pgp = require('pg-promise')(options);

const db = pgp('postgres://docker:docker@localhost:5432/docker');

module.exports = db;
