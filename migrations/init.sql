SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

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
    author      citext NOT NULL REFERENCES userForum (nickname),
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
    user_id     integer,
    forum_id    integer,
    UNIQUE (user_id, forum_id)
);

CREATE TABLE IF NOT EXISTS postThread (
    post_id     serial PRIMARY KEY,
    thread_id   integer NOT NULL
);

CREATE INDEX thread_forum_id_created ON threadForum (forum_id, created);
CREATE INDEX post_thread_path ON postForum (thread, path);
CREATE INDEX thread_post ON postThread (thread_id, post_id);
CREATE INDEX post_thread_id ON postForum (thread, id);
CREATE INDEX post_thread_path_1_path ON postForum (thread, (path[1]), path);
CREATE INDEX post_id_path_1 ON postForum ((path[1]), id);
CREATE INDEX post_thread_created_id ON postForum (thread, created, id);

-- CREATE INDEX post_thread_path_1 ON postForum (thread, (path[1]));
-- CREATE INDEX post_id_path_1 ON postForum (id, (path[1]));
-- CREATE INDEX post_thread_id ON postForum (thread, id);
-- CREATE INDEX post_thread_id ON postForum (thread, id DESC);
-- CREATE INDEX post_thread_path_desc ON postForum (thread, path DESC);
-- CREATE INDEX post_parent_thread_id ON postForum (parent, thread, id);
-- CREATE INDEX post_path_thread ON postForum (path, thread);
