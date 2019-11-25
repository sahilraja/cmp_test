import { Router } from "express";
import { APIError } from "../../utils/custom-error";
import { OK } from "http-status-codes";
import { createCompliance, editCompliance, listCompliances } from "./module";
const router = Router()

router.post(`/:id/compliance/create`, async (req, res, next) => {
    try {
        res.status(OK).send(await createCompliance(req.body, req.params.id, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))        
    }
})

router.get(`/:id/compliance/list`, async (req, res, next) => {
    try {
        res.status(OK).send(await listCompliances((req as any).token, req.params.id))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.put(`/:id/compliance/:compliance_id/edit`, async (req, res, next) => {
    try {
        res.status(OK).send(await editCompliance(req.params.compliance_id, req.body, res.locals.user))
    } catch (error) {
        next(new APIError(error.message))
    }
})

export = router