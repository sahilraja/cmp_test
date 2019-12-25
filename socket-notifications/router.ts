import { Router } from "express";
import { APIError } from "../utils/custom-error";
import { OK } from "http-status-codes";
import { create, list, markAsRead, listUnreadNotifications } from "./module";
import { authenticate } from "../utils/utils";
const router = Router()

router.post(`/create`, async (req, res, next) => {
    try {
        res.status(OK).send(await create(req.body))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.get(`/list`, authenticate, async (req, res, next) => {
    try {
        res.status(OK).send(await list(res.locals.user._id, req.query.page, req.query.limit))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.get(`/unread-notifications`, authenticate, async (req, res, next) => {
    try {
        res.status(OK).send(await listUnreadNotifications(res.locals.user._id))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.get(`/:id/detail`, async (req, res, next) => {
    try {
        res.status(OK).send({})
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.put(`/:id/mark-as-read`, async (req, res, next) => {
    try {
        res.status(OK).send(await markAsRead(req.params.id, res.locals.user._id))
    } catch (error) {
        next(new APIError(error.message))
    }
})

export = router