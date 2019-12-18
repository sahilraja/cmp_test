import { Router } from "express";
import { APIError } from "../utils/custom-error";
import { OK } from "http-status-codes";
import { stepDetail, list } from "../steps/module";
const router = Router()

router.get(`/step-info`, async (req, res, next) =>  {
    try {
        res.status(OK).send(await stepDetail(req.params.stepId))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.get(`/get-all-steps`, async (req, res, next) =>  {
    try {
        res.status(OK).send(await list())
    } catch (error) {
        next(new APIError(error.message))
    }
})

export = router