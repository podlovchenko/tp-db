CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;

CREATE TABLE IF NOT EXISTS userForum (
    id          serial PRIMARY KEY,
    about       text,
    email       citext NOT NULL UNIQUE,
    fullname    text NOT NULL,
    nickname    citext NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS Forum (
	id          serial PRIMARY KEY,
    posts       integer DEFAULT 0,
    slug        citext UNIQUE,
    threads     integer DEFAULT 0,
    title       text NOT NULL,
    admin       citext NOT NULL,
    admin_id    integer REFERENCES userForum (id)
);

CREATE TABLE IF NOT EXISTS threadForum (
    author      citext NOT NULL,
    author_id   integer REFERENCES userForum (id),
    created     timestamptz DEFAULT now(),
    forum       citext,
    forum_id    integer REFERENCES Forum (id),
    id          serial PRIMARY KEY,
    message     text NOT NULL,
    slug        citext UNIQUE,
    title       text NOT NULL,
    votes       integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS postForum (
    author      citext NOT NULL,
    author_id   integer REFERENCES userForum (id),
    created     timestamptz DEFAULT now(),
    forum       citext,
    forum_id    integer REFERENCES Forum (id),
    id          serial PRIMARY KEY,
    isEdited    boolean DEFAULT false,
    message     text NOT NULL,
    parent      integer DEFAULT 0,
    thread      integer REFERENCES threadForum (id),
    path        integer ARRAY
);

CREATE TABLE IF NOT EXISTS Votes (
    author_id   integer REFERENCES userForum (id),
    thread      integer REFERENCES threadForum (id),
    voice       smallint NOT NULL,
    UNIQUE (author_id, thread)
);

CREATE TABLE IF NOT EXISTS forumUsers (
    user_id     integer REFERENCES userForum (id) NOT NULL,
    forum_id    integer REFERENCES Forum (id) NOT NULL,
    UNIQUE (forum_id, user_id)
);

CREATE INDEX thread_forum_id ON threadForum (forum_id);
CREATE INDEX post_thread_created_id ON postForum (thread, created, id);
CREATE INDEX post_thread_path_1 ON postForum (thread, (path[1]));
CREATE INDEX post_id_path_1 ON postForum (id, (path[1]));
CREATE INDEX post_thread_id ON postForum (thread, id);

CREATE INDEX thread_forum_id ON threadForum (forum_id);
CREATE INDEX post_thread ON postForum (thread);
CREATE INDEX post_thread_path ON postForum (thread, path);