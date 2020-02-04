import { Router } from "express";
import { OK } from "http-status-codes";
import { getPhase, editPhase, deletePhase, listPhase, createPhase, userListPhase } from "./module";
import { processMongooseErrors } from "../utils/error-handling-utils";
import { APIError } from "../utils/custom-error";
const router = Router()

router.post(`/create`, async (req, res, next) => {
    try {
        res.status(OK).send(await createPhase(req.body, res.locals.user));
    } catch (error) {
        if (error.code == 11000) {
            error.message = `Phase already exists`
        }
        next(new APIError(error.message));
    }
})

router.get(`/getPhase/:id`, async (req, res, next) => {
    try {
        res.status(OK).send(await getPhase(req.params.id))
    } catch (error) {
        next(new APIError(error.message));
    }
})

router.put('/edit/:id', async (req, res, next) => {
    try {
        res.status(OK).send(await editPhase(req.params.id, req.body, res.locals.user,(req as any).token, `${req.protocol}://${req.get('host')}`));
    } catch (error) {
        if (error.code == 11000) {
            error.message = `Phase already exists`
        }
        next(new APIError(error.message));
    }
})
router.post(`/deletePhase/:id`, async (req, res, next) => {
    try {
        res.status(OK).send(await deletePhase(req.params.id));
    } catch (error) {
        next(new APIError(error.message));
    }
})

router.get(`/list`, async (req, res, next) => {
    try {
        res.status(OK).send(await listPhase());
    } catch (error) {
        next(new APIError(error.message));
    }
})
router.get(`/userPhase/list/:id`, async (req, res, next) => {
    try {
        res.status(OK).send(await userListPhase(req.params.id));
    } catch (error) {
        next(new APIError(error.message));
    }
})

export = router