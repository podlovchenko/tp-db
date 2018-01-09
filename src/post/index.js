const express = require('express');

const router = express.Router();

const db = require('../db');

router.get('/:id/details', async (req, res) => {
  try {
    const post = await db.one('SELECT * FROM postForum WHERE id=$1', req.params.id);

    const answer = {};
    answer.post = post;
    answer.post.isEdited = answer.post.isedited;

    if (req.query.related) {
      const data = await db.tx(t => {
        const sql = [];
        req.query.related = req.query.related.split(',');

        for (let i = 0; i < req.query.related.length; i++) {
          let table,
            field,
            value;
          switch (req.query.related[i]) {
            case ('user'):
              table = 'userForum';
              field = 'id';
              value = post.author_id;
              break;
            case ('forum'):
              table = 'Forum';
              field = 'id';
              value = post.forum_id;
              break;
            case ('thread'):
              table = 'threadForum';
              field = 'id';
              value = post.thread;
              break;
          }

          sql.push(db.one(`SELECT ${table}.* FROM ${table} WHERE ${field}=$1`, value));
        }

        return t.batch(sql);
      });

      for (let i = 0; i < req.query.related.length; i++) {
        switch (req.query.related[i]) {
          case ('user'):
            answer['author'] = data[i];
            break;
          case ('forum'):
            answer['forum'] = data[i];
            answer.forum.user = answer.forum.admin;
            break;
          case ('thread'):
            answer['thread'] = data[i];
            break;
        }
      }
    }


    res.status(200).json(answer);
  } catch (error) {
    res.status(404).json({
      message: 'Error!\n',
    });
  }
});

router.post('/:id/details', async (req, res) => {
  try {
    let post = await db.one('SELECT * FROM postForum WHERE id=$1', req.params.id);

    if (!Object.keys(req.body).length || !post.message.localeCompare(req.body.message)) {
      res.status(200).json(post);
    } else {
      post = await db.one('UPDATE postForum SET message=$1, isEdited=true WHERE id=$2 RETURNING *', [req.body.message, req.params.id])
      post.isEdited = true;
      res.status(200).json(post);
    }
  } catch (error) {
    res.status(404).json({
      message: 'Error!\n',
    });
  }
});

module.exports = router;
