const express = require('express');
const router = express.Router();

const db = require('../db');

router.post('/:slug_or_id/create', async (req, res) => {
  const field = isNaN(req.params.slug_or_id) ? 'slug' : 'id';
  const created = new Date();

  let ids = [];
  if (req.body.length) {
    ids = await db.many('SELECT nextval(\'postforum_id_seq\') from generate_series(1, $1)', [req.body.length]);
  }

  const users = {};

  try {
    const thread = await db.one(`SELECT * FROM threadForum WHERE ${field}=$1`, req.params.slug_or_id);

    try {
      const answer = await db.tx(async (t) => {
        const queries = [];

        let id;
        let path;
        let parent;

        for (let i = 0; i < req.body.length; i++) {
          id = Number(ids[i].nextval);

          let user;

          if (!users[req.body[i].author]) {
            try {
              user = await db.one('SELECT * FROM userForum WHERE nickname=$1', req.body[i].author);
              users[user.nickname] = user.id;
            } catch (error) {
              error.user = true;
              throw error;
            }
          }

          if (!req.body[i].parent || req.body[i].parent === 0) {
            queries.push(t.one('INSERT INTO postForum (id, path, author, author_id, created, forum, forum_id, message, parent, thread) values($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *',
              [id, [id], req.body[i].author, users[req.body[i].author], created, thread.forum, thread.forum_id, req.body[i].message, 0, thread.id]));
          } else {
            parent = await db.one('SELECT path FROM postForum WHERE id=$1 AND thread=$2', [req.body[i].parent, thread.id]);
            path = parent.path;

            queries.push(t.one('INSERT INTO postForum (id, path, author, author_id, created, forum, forum_id, message, parent, thread) values($1, array_append($2, $3::INT), $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *',
              [id, path, id, req.body[i].author, users[req.body[i].author], created, thread.forum, thread.forum_id, req.body[i].message, req.body[i].parent, thread.id]));
          }
        }

        return t.batch(queries);
      });


      try {
        await db.tx(async (t) => {
          const queries = [];

          for (let user in users) {
            queries.push(t.none('INSERT INTO forumUsers (user_id, forum_id) values($1, $2) ON CONFLICT DO NOTHING', [users[user], thread.forum_id]));
          }

          return t.batch(queries);
        });
      } catch (error) {}

      await db.none('UPDATE Forum SET posts=posts+$1 WHERE id=$2', [req.body.length, thread.forum_id]);

      res.status(201).json(answer);
    } catch (error) {
      if (error.user || (error.data && error.data[0].result.code === '23503')) {
        res.status(404).json({
          "message": "Error!\n"
        });
      } else {
        res.status(409).json({
          "message": "Error!\n"
        });
      }
    }
  } catch (error) {
    res.status(404).json({
      message: 'Error!\n',
    });
  }
});

router.get('/:slug_or_id/details', async (req, res) => {
  const field = isNaN(req.params.slug_or_id) ? 'slug' : 'id';

  try {
    res.status(200).json(await db.one(`SELECT * FROM threadForum WHERE ${field}=$1`, req.params.slug_or_id));
  } catch (error) {
    res.status(404).json({
      message: 'Error!\n',
    });
  }
});

router.post('/:slug_or_id/details', async (req, res) => {
  const field = isNaN(req.params.slug_or_id) ? 'slug' : 'id';

  try {
    if (!Object.keys(req.body).length) {
      res.status(200).json(await db.one(`SELECT * FROM threadForum WHERE ${field}=$1`, req.params.slug_or_id));
    } else {
      let sql = '';

      if (req.body.message) {
        sql += 'message=$2';

        if (req.body.title) {
          sql += ', title=$3';
        }
      } else {
        sql += 'title=$3';
      }

      res.status(200).json(await db.one(`UPDATE threadForum SET ` + sql + ` WHERE ${field}=$1 RETURNING *`,
        [req.params.slug_or_id, req.body.message, req.body.title]));
    }
  } catch (error) {
    res.status(404).json({
      message: 'Error!\n',
    });
  }
});

router.get('/:slug_or_id/posts', async (req, res) => {
    const field = isNaN(req.params.slug_or_id) ? 'slug' : 't.id';

    const limit = req.query.limit || 'ALL';
    const orderBy = req.query.desc === 'true' ? 'DESC ' : '';
    const sign = req.query.desc === 'true' ? '<' : '>';
    const since = req.query.since ? `AND id${sign}\${since} ` : '';

    const sql = req.query.since ? ` JOIN postForum p ON p.id=\${since}` : '';
    const values = req.query.since ? `t.id as id, p.path as path` : '*';

    try {
      const thread = await db.one(`SELECT ${values} FROM threadForum t${sql} WHERE ${field}=\${slug_or_id}`, Object.assign({}, req.params, req.query));

      if (req.query.sort) {
        switch (req.query.sort) {
          case('tree'):
            const tree = req.query.since ? `AND path${sign}\${path} ` : '';

            try {
              res.status(200).json(await db.many(`SELECT * FROM postForum WHERE thread=\${id} ${tree} ORDER BY path ${orderBy}LIMIT ${limit}`,
                Object.assign({}, req.params, req.query, thread)));
            } catch (error) {
              res.status(200).json([]);
            }
            break;
          case('parent_tree'):
            const parent_tree = req.query.since ? `AND id${sign}${thread.path[0]} ` : '';

            try {
              res.status(200).json(await db.many(`SELECT * FROM postForum WHERE path[1] IN (SELECT id FROM postForum WHERE parent=0 AND thread=\${id} ${parent_tree} ORDER BY id ${orderBy} LIMIT ${limit}) AND thread=\${id} ORDER BY path[1] ${orderBy}, path ${orderBy}`,
                Object.assign({}, req.params, req.query, thread)));
            } catch (error) {
              res.status(200).json([]);
            }
            break;
          default:
            try {
              res.status(200).json(await db.many(`SELECT * FROM postForum WHERE thread=\${id} ${since}ORDER BY id ${orderBy}LIMIT ${limit}`,
                Object.assign({}, req.params, req.query, thread)));
            } catch (error) {
              res.status(200).json([]);
            }
            break;
        }
      } else {
        try {
          res.status(200).json(await db.many(`SELECT * FROM postForum WHERE thread=\${id} ${since}ORDER BY id ${orderBy}LIMIT ${limit}`,
            Object.assign({}, req.params, req.query, thread)));
        } catch (error) {
          res.status(200).json([]);
        }
      }
    } catch (error) {
      res.status(404).json({
        message: 'Error!\n',
      });
    }
  }
);

router.post('/:slug_or_id/vote', async (req, res) => {
  const field = isNaN(req.params.slug_or_id) ? 'slug' : 'id';

  try {
    const thread = await db.one(`SELECT * FROM threadForum WHERE ${field}=$1`, [req.params.slug_or_id]);
    const author = await db.one('SELECT * FROM userForum WHERE nickname=$1', [req.body.nickname]);

    try {
      await db.none('INSERT INTO Votes (author_id, thread, voice) VALUES ($1, $2, $3)', [author.id, thread.id, req.body.voice]);
      res.status(200).json(await db.one('UPDATE threadForum SET votes=votes+$1 WHERE id=$2 RETURNING *', [req.body.voice, thread.id]));
    } catch (error) {
      const vote = await db.one('SELECT * FROM Votes WHERE author_id=$1 AND thread=$2', [author.id, thread.id]);

      let diff = 0;

      if (Number(vote.voice) !== req.body.voice) {
        if (Number(vote.voice) === -1) {
          diff = 2;
        } else {
          diff = -2;
        }
      }

      await db.none('UPDATE Votes SET voice=$3 WHERE author_id=$1 AND thread=$2', [author.id, thread.id, req.body.voice]);
      res.status(200).json(await db.one('UPDATE threadForum SET votes=votes+$1 WHERE id=$2 RETURNING *', [diff, thread.id]));
    }
  }

  catch (error) {
    res.status(404).json({
      message: 'Error!\n',
    });
  }
});


module.exports = router;