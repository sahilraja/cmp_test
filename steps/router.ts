import { Router } from "express";
import { OK } from "http-status-codes";
import { create, list, stepDetail, updateStep, getStepsByIds } from "./module";
import { processMongooseErrors } from "../utils/error-handling-utils";
const router = Router()

router.post(`/create`, async (req, res, next) => {
    try {
        res.status(OK).send(await create(res.locals.user._id, req.body))
    } catch (error) {
        if (error.code == 11000) error.message = `${error.message.match(/{ : "(.*?)" }/g).pop().split('"')[1]} already exists`
        next(processMongooseErrors(error)[0] || processMongooseErrors(error))
    }
})

router.get(`/list`, async (req, res, next) => {
    try {
        res.status(OK).send(await list())
    } catch (error) {
        next(error)
    }
})

router.post(`/getStepsByIds`, async (req, res, next) => {
    try {
        res.status(OK).send(await getStepsByIds(req.body.stepIds))
    } catch (error) {
        next(error)
    }
})

router.get(`/:id/detial`, async (req, res, next) => {
    try {
        res.status(OK).send(await stepDetail(req.params.id))
    } catch (error) {
        next(error)
    }
})

router.post(`/:id/edit`, async (req, res, next) => {
    try {
        res.status(OK).send(await updateStep(req.params.id, req.body))
    } catch (error) {
        if (error.code == 11000) error.message = `${error.message.match(/{ : "(.*?)" }/g).pop().split('"')[1]} already exists`
        next(processMongooseErrors(error)[0] || processMongooseErrors(error))        
    }
})

export = router