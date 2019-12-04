import { Router } from "express";
import { OK } from "http-status-codes";
import { create, edit, list, detail, opportunitySaveAll, logList } from "./module";
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

router.post(`/:id/opportunity/edit/save-all`, async (req, res, next) => {
    try {
        res.status(OK).send(await opportunitySaveAll(req.params.id, req.body.saveAll, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))
    };
});

router.get(`/:id/opportunity/:opportunity_id/edit-history/list`, async (req, res, next) => {
    try {
        res.status(OK).send(await logList(req.params.id, req.params.opportunity_id))
    } catch (error) {
        next(new APIError(error.message))
    };
});

router.get(`/:id/opportunity/:opportunity_id`, async (req, res, next) => {
    try {
        res.status(OK).send(await detail(req.params.opportunity_id))
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