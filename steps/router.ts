import { Router } from "express";
import { OK } from "http-status-codes";
import { create, list, stepDetail, updateStep } from "./module";
const router = Router()

router.post(`/create`, async (req, res, next) => {
    try {
        res.status(OK).send(await create((req as any).user._id, req.body))
    } catch (error) {
        next(error)
    }
})

router.get(`/list`, async (req, res, next) => {
    try {
        res.status(OK).send(await list())
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
        next(error)
    }
})

export = router