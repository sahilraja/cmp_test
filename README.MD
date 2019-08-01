# Introduction
This is a starter project to quickly get up and running with express js project using typescript.

# Setup
```sh
git clone https://github.com/WebileApps/express-ts-starter.git
cd express-ts-starter
npm install
```
Open Visual Studio Code and Run (F5)

# Adding routers

A sample router for `users` is provided by default and mounted at `/users`.
```typescript
import * as usersRouter from "./users/router";
...

app.use('/users', usersRouter);

```