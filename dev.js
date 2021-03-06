const express = require('express');
const body = require('body-parser');

const Forum = require('./src/forum/index');
const Post = require('./src/post/index');
const Service = require('./src/service/index');
const Thread = require('./src/thread/index');
const User = require('./src/user/index');

const app = express();
const port = process.env.PORT || 5000;

app.use(body.json());

app.use('/api/forum', Forum);
app.use('/api/post', Post);
app.use('/api/service', Service);
app.use('/api/thread', Thread);
app.use('/api/user', User);

app.listen(port, () => {
  console.log(`Server listening port ${port}`);
});