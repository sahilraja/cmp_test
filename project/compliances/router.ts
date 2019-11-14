import { Router } from "express";
import { APIError } from "../../utils/custom-error";
import { OK } from "http-status-codes";
import { createCompliance, editCompliance, listCompliances } from "./module";
const router = Router()

router.post(`/create`, async (req, res, next) => {
    try {
        res.status(OK).send(await createCompliance(req.body, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))        
    }
})

router.get(`/list`, async (req, res, next) => {
    try {
        res.status(OK).send(await listCompliances((req as any).token))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.put(`/:id/edit`, async (req, res, next) => {
    try {
        res.status(OK).send(await editCompliance(req.params.id, req.body, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))
    }
})

export = router