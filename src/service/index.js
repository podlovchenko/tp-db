const express = require('express');

const router = express.Router();

const db = require('../db');

router.post('/clear', async (req, res) => {
  await db.tx(t => t.batch([
    db.none('TRUNCATE Forum CASCADE'),
    db.none('TRUNCATE postForum CASCADE'),
    db.none('TRUNCATE threadForum CASCADE'),
    db.none('TRUNCATE userForum CASCADE'),
    db.none('TRUNCATE Votes CASCADE'),
    db.none('TRUNCATE forumUsers CASCADE'),
  ]));

  res.status(200).send();
});

router.get('/status', async (req, res) => {
  const body = {};

  const result = await db.tx(t => t.batch([
    db.one('SELECT COUNT(*) FROM Forum'),
    db.one('SELECT COUNT(*) FROM postForum'),
    db.one('SELECT COUNT(*) FROM threadForum'),
    db.one('SELECT COUNT(*) FROM userForum'),
  ]));

  body.forum = Number(result[0].count);
  body.post = Number(result[1].count);
  body.thread = Number(result[2].count);
  body.user = Number(result[3].count);

  res.status(200).json(body);
});

module.exports = router;
