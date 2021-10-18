# Template-telegram-bot

All of the code is written in typescript which is similar to javascript but is type safe. Watch this [Youtube Crash Course](https://www.youtube.com/watch?v=rAy_3SIqT-E) if you are not familiar.

## Getting started with template

Click [use this template](https://docs.github.com/en/github/creating-cloning-and-archiving-repositories/creating-a-repository-on-github/creating-a-repository-from-a-template) to create a new Repo for your new telegram bot

### Setup environment

See [`.env.example`](.env.example) for example on how to set up your `.env` file. _Remember to not commit `.env` into version control. [Read more on `.env`](https://12factor.net/config)_

[Set up env variables in heroku (Production)](https://devcenter.heroku.com/articles/config-vars#using-the-heroku-dashboard)

#### Nodejs

The main engine the bot runs on is nodeJS. There is a [Youtube Video](https://www.youtube.com/watch?v=zRo2tvQpus8) on how to setup Typescript with Nodejs & Express(not required)

[NodeJS Download](https://nodejs.org/en/download/)

#### Database

As this bot has a database to read and write information into, you need to set up either a local development database or use your production database for your development work. The latter is not recommended in-case you wipe your production database and cause the bot to lose all memory.

[PostgreSQL Download](https://www.postgresql.org/download/)

### Developing

`npm install` to install the dependencies

`npm run dev` to run the bot in development environment

`npm run migrate` to generate a new database migration based on the current database schema

### Production

We run the bot on a [heroku](https://heroku.com/) dyno for [free](https://www.heroku.com/pricing) as it also provides [free](https://devcenter.heroku.com/articles/heroku-postgres-plans#hobby-tier) [PostgreSQL](https://devcenter.heroku.com/articles/heroku-postgresql) dB.

_Downside of heroku will be how the app will go to sleep if nobody is using, takes <30s for a telegram bot to boot up once someone sends a message to the bot_

[Article on how to setup free Heroku PostgreSQL](https://dev.to/prisma/how-to-setup-a-free-postgresql-database-on-heroku-1dc1#step-4-access-the-database-credentials-and-connection-url)

`npm run build` to push the dB schema onto the production server and compile the code

`npm run start` to start the compiled code

This two commands will be ran automatically by heroku once it receives the code

## Resources

### Telegraf

- [Github Repo](https://github.com/telegraf/telegraf)
- [Getting started](https://github.com/telegraf/telegraf#getting-started)
- [API reference](https://telegraf.js.org/modules.html)
- [Telegram group for Telegraf](https://t.me/TelegrafJSChat)
- [GitHub Discussions](https://github.com/telegraf/telegraf/discussions)
- [Dependent repositories](https://libraries.io/npm/telegraf/dependent_repositories)

### Prisma

- [Github Repo](https://github.com/prisma/prisma)

The fastest way to get started with Prisma is by following the [**Quickstart (5 min)**](https://www.prisma.io/docs/getting-started/quickstart-typescript).

The Quickstart is based on a preconfigured SQLite database. You can also get started with your own database (PostgreSQL and MySQL) by following one of these guides:

- [Add Prisma to an existing project](https://www.prisma.io/docs/getting-started/setup-prisma/add-to-existing-project-typescript-postgres)
- [Setup a new project with Prisma from scratch](https://www.prisma.io/docs/getting-started/setup-prisma/start-from-scratch-typescript-postgres)

### Heroku

- [Heroku plans and pricing](https://www.heroku.com/pricing)
- [Link Github Repo to Heroku so that it will automatically push the changes made](https://devcenter.heroku.com/articles/github-integration)
- [Heroku Command Line Tools (CLI)](https://devcenter.heroku.com/articles/heroku-cli)
- [Get Heroku Logs (1500 lines max)](https://devcenter.heroku.com/articles/logging#log-retrieval-via-cli)
- [Heroku Config Vars (`.env`)](https://devcenter.heroku.com/articles/config-vars#using-the-heroku-dashboard)

## Built with

Telegraf
Prisma
PostgreSQL

Hosted on Heroku
