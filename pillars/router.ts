import { Router } from "express";
import { OK } from "http-status-codes";
import { create, list, pillarDetail, updatePillar, getPillars, getPillarsbyIds } from "./module";
import { processMongooseErrors } from "../utils/error-handling-utils";
import { authenticate } from "../utils/utils";
const router = Router()

router.post(`/create`, authenticate, async (req, res, next) => {
    try {
        res.status(OK).send(await create(res.locals.user._id, req.body, res.locals.user.role))
    } catch (error) {
        if (error.code == 11000) error.message = `${error.message.match(/{ : "(.*?)" }/g).pop().split('"')[1]} already exists`
        next(processMongooseErrors(error)[0] || processMongooseErrors(error))
    }
})

router.get(`/list`, async (req, res, next) => {
    try {
        res.status(OK).send(await list((req as any).token))
    } catch (error) {
        next(error)
    }
})

router.get(`/:id/detial`, async (req, res, next) => {
    try {
        res.status(OK).send(await pillarDetail(req.params.id))
    } catch (error) {
        next(error)
    }
})

router.post(`/:id/edit`, authenticate, async (req, res, next) => {
    try {
        res.status(OK).send(await updatePillar(req.params.id, req.body, res.locals.user.role))
    } catch (error) {
        if (error.code == 11000) error.message = `${error.message.match(/{ : "(.*?)" }/g).pop().split('"')[1]} already exists`
        next(processMongooseErrors(error)[0] || processMongooseErrors(error))
    }
})

router.get(`/getPillars`, async (req, res, next) => {
    try {
        res.status(OK).send(await getPillars())
    } catch (error) {
        next(error)
    }
})

router.post(`/getPillarByIds`, async (req, res, next) => {
    try {
        res.status(OK).send(await getPillarsbyIds(req.body.pillarIds))
    } catch (error) {
        next(error)
    }
})

export = router