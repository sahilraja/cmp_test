import { Router } from "express";
import { OK } from "http-status-codes";
const router = Router()

router.post(`/create`, async (req, res, next) => {
    try {
        res.status(OK).send({})
    } catch (error) {
        next(error)
    }
})

router.get(`/list`, async (req, res, next) => {
    try {
        res.status(OK).send({})
    } catch (error) {
        next(error)
    }
})

router.get(`/:id/detial`, async (req, res, next) => {
    try {
        res.status(OK).send({})
    } catch (error) {
        next(error)
    }
})

router.post(`/:id/edit`, async (req, res, next) => {
    try {
        res.status(OK).send({})
    } catch (error) {
        next(error)
    }
})

export = router