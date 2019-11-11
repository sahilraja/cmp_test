import { Router } from "express";
import { OK } from "http-status-codes";
import { getPhase, editPhase, deletePhase, listPhase, createPhase } from "./module";
import { processMongooseErrors } from "../utils/error-handling-utils";
import { APIError } from "../utils/custom-error";
const router = Router()

router.post(`/create`, async (req, res, next) => {
    try {
        res.status(OK).send(await createPhase(req.body))
    } catch (error) {
        if (error.code == 11000) {
            error.message = `Phase already exists`
        }
        next(new APIError(error.message));
    }
})

router.get(`/getPhase`, async (req, res, next) => {
    try {
        res.status(OK).send(await getPhase(req.params.phase))
    } catch (error) {
        next(new APIError(error.message));
    }
})

router.put('/edit', async (req, res, next) => {
    try {
        res.status(OK).send(await editPhase(req.body.phaseName, req.body.colorCode));
    } catch (error) {
        next(new APIError(error.message));
    }
})
router.get(`/deletePhase`, async (req, res, next) => {
    try {
        res.status(OK).send(await deletePhase(req.query.phaseName));
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

export = router