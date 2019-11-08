import { Router } from "express";
import { APIError } from "../../utils/custom-error";
import { OK } from "http-status-codes";
import { createCompliance } from "./module";
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
        res.status(OK).send({})
    } catch (error) {
        next(new APIError(error.message))
    }
})

export = router