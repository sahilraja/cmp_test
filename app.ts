const express = require("express");
import { connect as mongooseConnect } from "mongoose";
import { Application, Request, Response, Handler } from "express";
import { OK, INTERNAL_SERVER_ERROR } from "http-status-codes";
import * as usersRouter from "./users/router";

const app : Application = express();

mongooseConnect('mongodb://localhost:27017/doctors', {useNewUrlParser: true});

app.get('/', (request : Request, response : Response) => {
    response.status(OK).send("Hello World");
});

app.use('/users', usersRouter);

app.use((error: Error, request : Request, response : Response, next : Handler) => {
   response.status((error as any).code < 600 ? (error as any).code : INTERNAL_SERVER_ERROR || INTERNAL_SERVER_ERROR).send({errors: [{error: error.message || (error as any).error}]}) 
});

export = app;