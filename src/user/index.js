const express = require('express');
const router = express.Router();

const db = require('../db');

router.post('/:nickname/create', async (req, res) => {
  try {
    res.status(201).json(await db.one('INSERT INTO userForum (about, email, fullname, nickname) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.body.about, req.body.email, req.body.fullname, req.params.nickname]));
  } catch (error) {
    res.status(409).json(await db.many('SELECT * FROM userForum WHERE email=$1 OR nickname=$2', [req.body.email, req.params.nickname]));
  }
});

router.get('/:nickname/profile', async (req, res) => {
  try {
    res.status(200).json(await db.one('SELECT * FROM userForum WHERE nickname=$1', req.params.nickname));
  } catch (error) {
    res.status(404).json({
      "message": "Error!\n"
    });
  }
});

router.post('/:nickname/profile', async (req, res) => {
  try {
    const user = await db.one('SELECT * FROM userForum WHERE nickname=$1', req.params.nickname);

    if (!Object.keys(req.body).length) {
      res.status(200).json(user);
    } else {
      let sqlSetAbout = '', sqlSetEmail = '', sqlSetFullname = '';

      if (req.body['about']) {
        sqlSetAbout = 'about=${about}';

        if (req.body['email'] || req.body['fullname']) {
          sqlSetAbout += ', ';
        }
      }

      if (req.body['email']) {
        sqlSetEmail = 'email=${email}';

        if (req.body['fullname']) {
          sqlSetEmail += ', ';
        }
      }

      if (req.body['fullname']) {
        sqlSetFullname = 'fullname=${fullname}';
      }

      const result = await db.one('UPDATE userForum SET ' + sqlSetAbout + sqlSetEmail + sqlSetFullname + ' WHERE nickname=${nickname} RETURNING *',
        Object.assign({}, req.body, req.params));

      res.status(200).json(result);
    }
  } catch (error) {
    switch (error.code) {
      case '23505':
        res.status(409).send({
          message: 'Error!\n',
        });
        break;
      default:
        res.status(404).json({
          message: 'Error!\n',
        });
    }
  }
});

module.exports = router;
