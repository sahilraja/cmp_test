const express = require("express");
import { connect as mongooseConnect } from "mongoose";
import { Application, Request, Response, Handler } from "express";
import { OK, INTERNAL_SERVER_ERROR } from "http-status-codes";
import * as bodyParser from 'body-parser'
import * as cors from 'cors';

//  module imports
import * as usersRouter from "./users/router";
import * as roleRouter from "./role/router";
import * as projectRouter from "./project/router";
import * as documentRouter from "./documents/router";
import * as taskRouter from "./task/router";
import * as tagRouter from "./tags/router";
import * as templateRouter from "./email-templates/router"
import * as commentRouter from "./comments/router"
import * as pillarRouter from "./pillars/router";
import * as stepRouter from "./steps/router";
import * as privateGroup from "./private-groups/router";
import * as activityRouter from "./log/router";
import * as constantsRouter from "./site-constants/router";
import * as phaseRouter from "./phase/router";

// implement multer
import * as multer from "multer";
import { authenticate } from "./utils/utils";
var upload = multer({ dest: 'uploads/' });

const app: Application = express();

//  implement cors
app.use(cors())

//  mongoose connection
require('./utils/mongoose');

//  swagger implementation
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const swaggerDocument = YAML.load("./compiled-swagger.yaml");

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
app.use("/project", authenticate, projectRouter);
app.use("/docs", documentRouter)
app.use("/task", taskRouter)
app.use("/tag", tagRouter);
app.use("/template", templateRouter);
app.use("/comments", authenticate, commentRouter);
app.use(`/pillars`, authenticate, pillarRouter)
app.use(`/steps`, authenticate, stepRouter)
app.use(`/private-group`, privateGroup)
app.use(`/activity`, activityRouter)
app.use('/constants', constantsRouter);
app.use('/phases',authenticate,phaseRouter);

app.use((error: Error, request: Request, response: Response, next: Handler) => {
    response.status((error as any).code < 600 ? (error as any).code : INTERNAL_SERVER_ERROR || INTERNAL_SERVER_ERROR).send({ errors: [{ error: error.message || (error as any).error }] })
});

export = app;