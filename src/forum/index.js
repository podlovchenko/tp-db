const express = require('express');

const router = express.Router();

const db = require('../db');

router.post('/create', async (req, res) => {
  try {
    const user = await db.one('SELECT * FROM userForum WHERE nickname=$1', req.body.user);
    const result = await db.one('INSERT INTO Forum (slug, title, admin, admin_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.body.slug, req.body.title, user.nickname, user.id]);
    result.user = result.admin;
    res.status(201).json(result);
  } catch (error) {
    switch (error.code) {
      case '23505':
        const result = await db.one('SELECT * FROM Forum WHERE slug=${slug}', req.body);
        result.user = result.admin;
        res.status(409).send(result);
        break;
      default:
        res.status(404).json({
          message: 'Error!\n',
        });
    }
  }
});

router.post('/:slug/create', async (req, res) => {
  try {
    const user = await db.one('SELECT * FROM userForum WHERE nickname=$1', req.body.author);
    const forum = await db.one('SELECT * FROM Forum WHERE slug=$1', req.params.slug);
    const result = await db.one('INSERT INTO threadForum (author, author_id, created, forum, forum_id, message, slug, title) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [user.nickname, user.id, req.body.created || null, forum.slug, forum.id, req.body.message, req.body.slug || null, req.body.title]);
    await db.none('UPDATE Forum SET threads=threads+1 WHERE id=$1', forum.id);
    await db.none('INSERT INTO forumUsers (user_id, forum_id) VALUES ($1, $2) ON CONFLICT (user_id, forum_id) DO NOTHING', [user.id, forum.id]);
    res.status(201).json(result);
  } catch (error) {
    switch (error.code) {
      case '23505':
        res.status(409).send(await db.one('SELECT * FROM threadForum WHERE slug=$1', req.body.slug));
        break;
      default:
        res.status(404).json({
          message: 'Error!\n',
        });
    }
  }
});

router.get('/:slug/details', async (req, res) => {
  try {
    const forum = await db.one('SELECT * FROM Forum WHERE slug=$1', req.params.slug);
    forum.user = forum.admin;
    res.status(200).json(forum);
  } catch (error) {
    res.status(404).json({
      message: 'Error!\n',
    });
  }
});

router.get('/:slug/threads', async (req, res) => {
  try {
    const forum = await db.one('SELECT * FROM Forum WHERE slug=$1', req.params.slug);

    const limit = req.query.limit || 'ALL';
    const orderBy = req.query.desc === 'true' ? 'DESC' : '';
    const sign = req.query.desc === 'true' ? '<=' : '>=';
    const since = req.query.since ? `AND created${sign}$2 ` : '';

    try {
      res.status(200).json(await db.many(`SELECT * FROM threadForum WHERE forum_id=$1 ${since}ORDER BY created ${orderBy} LIMIT ${limit}`,
        [forum.id, req.query.since]));
    } catch (error) {
      res.status(200).json([]);
    }
  } catch (error) {
    res.status(404).json({
      message: 'Error!\n',
    });
  }
});

router.get('/:slug/users', async (req, res) => {
  try {
    const forum = await db.one('SELECT * FROM Forum WHERE slug=$1', req.params.slug);

    const limit = req.query.limit || 'ALL';
    const orderBy = req.query.desc === 'true' ? 'DESC' : '';
    const since = req.query.since ? req.query.desc === 'true' ? 'WHERE userForum.nickname::citext<$2::citext ' : 'WHERE userForum.nickname::citext>$2::citext ' : '';

    try {
      res.status(200).json(await db.many(`SELECT * FROM userForum JOIN forumUsers ON (userForum.id = forumUsers.user_id AND forumUsers.forum_id=$1) ${since}ORDER BY userForum.nickname ${orderBy} LIMIT ${limit}`,
        [forum.id, req.query.since]));
    } catch (error) {
      res.status(200).json([]);
    }
  } catch (error) {
    res.status(404).json({
      message: 'Error!\n',
    });
  }
});

module.exports = router;
