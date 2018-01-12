const express = require('express');
const router = express.Router();

const db = require('../db');

router.post('/:slug_or_id/create', async (req, res) => {
  const field = isNaN(req.params.slug_or_id) ? 'slug' : 'id';
  const created = new Date();

  let flag = false;

  let ids = [];
  if (req.body.length) {
    ids = await db.many('SELECT nextval(\'postforum_id_seq\') from generate_series(1, $1)', [req.body.length]);

    const users = {};

    try {
      const thread = await db.one(`SELECT * FROM threadForum WHERE ${field}=$1`, req.params.slug_or_id);

      try {
        flag = true;
        await db.one(`SELECT * FROM postThread WHERE thread_id=$1 LIMIT 1`, thread.id);
      } catch (error) {
        console.log(error)
        flag = false;
      }

      for (let i = 0; i < req.body.length; i++) {
        if (req.body[i].parent === 0 || !req.body[i].parent) {
          flag = true;
        }
      }

      if (flag === false) {
        console.log('error')
        throw 'error';
      }

      try {
        const answer = await db.tx(async (t) => {
          const queries = [];

          let id;
          let path;
          let parent;

          for (let i = 0, j = 0; i < req.body.length; i++) {
            id = Number(ids[i].nextval);

            users[req.body[i].author] = true;

            queries[i] = t.one('INSERT INTO postForum (id, path, author, created, forum, forum_id, message, parent, thread) values($1, array_append((SELECT path FROM postForum WHERE id=$8), $1::INT), $3, $4, $5, $6, $7, $8, $9) RETURNING *',
              [id, [id], req.body[i].author, created, thread.forum, thread.forum_id, req.body[i].message, req.body[i].parent, thread.id]);

            if (!req.body[i].parent || req.body[i].parent === 0) {
              queries[req.body.length + j] = t.none('INSERT INTO postThread (post_id, thread_id) values($1, $2)', [id, thread.id]);
              j++;
            }
          }

          return t.batch(queries);
        });

        try {
          await db.tx(async (t) => {
            const queries = [];

            for (let user in users) {
              queries.push(t.none('INSERT INTO forumUsers (user_id, forum_id) VALUES ((SELECT id FROM userForum WHERE nickname=$1), $2) ON CONFLICT (user_id, forum_id) DO NOTHING', [user, thread.forum_id]));
            }

            return t.batch(queries);
          });
        } catch (error) {
        }

        await db.none('UPDATE Forum SET posts=posts+$1 WHERE id=$2', [req.body.length, thread.forum_id]);

        res.status(201).json(answer.slice(0, req.body.length));
      } catch (error) {
        if (error.data && error.data[0].result.code === '23503') {
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
      if (error === 'error') {
        res.status(409).json({
          message: 'Error!\n',
        });
      }
      else {
        res.status(404).json({
          message: 'Error!\n',
        });
      }
    }
  } else {
    try {
      await db.one(`SELECT * FROM threadForum WHERE ${field}=$1`, req.params.slug_or_id);
      res.status(201).json([]);
    } catch (error) {
      res.status(404).json({
        message: 'Error!\n',
      });
    }
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
    const field = isNaN(req.params.slug_or_id) ? 'slug' : 'id';

    const limit = req.query.limit || 'ALL';
    const orderBy = req.query.desc === 'true' ? ' DESC' : '';
    const sign = req.query.desc === 'true' ? '<' : '>';
    const since = req.query.since ? `AND id${sign}${req.query.since} ` : '';

    try {
      const thread = await db.one(`SELECT id FROM threadForum WHERE ${field}=$1`, req.params.slug_or_id);

      if (req.query.sort) {
        switch (req.query.sort) {
          case('tree'):
            const tree = req.query.since ? `AND path${sign}(SELECT path FROM postForum WHERE id=$2) ` : '';

            try {
              res.status(200).json(await db.many(`SELECT * FROM postForum WHERE thread=$1 ${tree}ORDER BY path${orderBy} LIMIT ${limit}`,
                [thread.id, req.query.since]));
            } catch (error) {
              res.status(200).json([]);
            }
            break;
          case('parent_tree'):
            let post;
            let parent_tree = '';
            if (req.query.since) {
              post = await db.one('SELECT path FROM postForum WHERE id=$1', req.query.since);
              parent_tree = `AND post_id${sign}${post.path[0]} `;
            }

            try {
              res.status(200).json(await db.many(`SELECT * FROM postForum WHERE thread=$1 AND path[1] IN (SELECT post_id FROM postThread WHERE thread_id=$1 ${parent_tree}ORDER BY post_id${orderBy} LIMIT ${limit}) ORDER BY path${orderBy}`,
                thread.id));
            } catch (error) {
              res.status(200).json([]);
            }
            break;
          default:
            try {
              res.status(200).json(await db.many(`SELECT * FROM postForum WHERE thread=$1 ${since}ORDER BY id${orderBy} LIMIT ${limit}`,
                thread.id));
            } catch (error) {
              res.status(200).json([]);
            }
            break;
        }
      } else {
        try {
          res.status(200).json(await db.many(`SELECT * FROM postForum WHERE thread=$1 ${since}ORDER BY id${orderBy} LIMIT ${limit}`,
            thread.id));
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