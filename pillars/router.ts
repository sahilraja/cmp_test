import { Router } from "express";
import { OK } from "http-status-codes";
import { create, list, pillarDetail, updatePillar, getPillars, getPillarsbyIds } from "./module";
const router = Router()

router.post(`/create`, async (req, res, next) => {
    try {
        res.status(OK).send(await create(res.locals.user._id, req.body))
    } catch (error) {
        next(error)
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

router.post(`/:id/edit`, async (req, res, next) => {
    try {
        res.status(OK).send(await updatePillar(req.params.id, req.body))
    } catch (error) {
        next(error)
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