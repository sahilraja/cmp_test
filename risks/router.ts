import { Router } from "express";
import { APIError } from "../utils/custom-error";
import { OK } from "http-status-codes";
import { create, edit, list, detail, riskSaveAll, logList } from "./module";
const router = Router()

router.post(`/:id/risk/create`, async (req, res, next) => {
    try {
        res.status(OK).send(await create(req.body, req.params.id, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.get(`/:id/risk/list`, async (req, res, next) => {
    try {
        res.status(OK).send(await list(req.params.id))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.post(`/:id/risk/edit/save-all`, async (req, res, next) => {
    try {
        res.status(OK).send(await riskSaveAll(req.params.id, req.body.saveAll, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))
    };
});

router.get(`/:id/risk/:riskId/edit-history/list`, async (req, res, next) => {
    try {
        res.status(OK).send(await logList(req.params.id, req.params.riskId))
    } catch (error) {
        next(new APIError(error.message))
    };
});

router.get(`/:id/risk/:risk_id`, async (req, res, next) => {
    try {
        res.status(OK).send(await detail(req.params.risk_id))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.put(`/:id/risk/:risk_id`, async (req, res, next) => {
    try {
        res.status(OK).send(await edit(req.params.risk_id, req.body, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.delete(`/:id/risk/:risk_id`, async (req, res, next) => {
    try {
        res.status(OK).send(await edit(req.params.risk_id, { deleted: true }, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))
    }
})

export = router