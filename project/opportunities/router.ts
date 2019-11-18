import { Router } from "express";
import { OK } from "http-status-codes";
import { create, edit, list } from "./module";
import { APIError } from "../../utils/custom-error";
const router = Router()

router.post(`/:id/opportunity/create`, async (req, res, next) => {
    try {
        res.status(OK).send(await create(req.body, req.params.id, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.get(`/:id/opportunity/list`, async (req, res, next) => {
    try {
        res.status(OK).send(await list(req.params.id))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.put(`/:id/opportunity/:opportunity_id`, async (req, res, next) => {
    try {
        res.status(OK).send(await edit(req.params.opportunity_id, req.body, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.delete(`/:id/opportunity/:opportunity_id`, async (req, res, next) => {
    try {
        res.status(OK).send(await edit(req.params.opportunity_id, { deleted: true }, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))
    }
})

export = router