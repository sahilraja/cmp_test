const express = require("express");
import { connect as mongooseConnect } from "mongoose";
import { Application, Request, Response, Handler } from "express";
import { OK, INTERNAL_SERVER_ERROR } from "http-status-codes";
import * as bodyParser from 'body-parser'

//  module imports
import * as usersRouter from "./users/router";
import * as roleRouter from "./role/router";
import * as projectRouter from "./project/router";

// implement multer
import * as multer  from "multer";
var upload = multer({ dest: 'uploads/' });

const app: Application = express();

//  mongoose connection
mongooseConnect(process.env.MONGO_URL as any, { useNewUrlParser: true });

//  swagger implementation
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const swaggerDocument = YAML.load("./openapi.yaml");

// body paser
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())

//  Hello world Router
app.get('/', (request: Request, response: Response) => {
    response.status(OK).send("Hello World");
});

//  Middleware
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument))
app.use('/user', usersRouter);
app.use("/role", roleRouter);

app.use((error: Error, request: Request, response: Response, next: Handler) => {
    response.status((error as any).code < 600 ? (error as any).code : INTERNAL_SERVER_ERROR || INTERNAL_SERVER_ERROR).send({ errors: [{ error: error.message || (error as any).error }] })
});

export = app;