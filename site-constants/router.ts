import { Router, Request, Response, NextFunction, Handler } from "express";
import { OK } from "http-status-codes";
import { constantSchema } from "./model";
import { APIError } from "../utils/custom-error";
import { constantsList, addConstants, createConstant, getConstantsGroupBy, getConstantsAndValues } from "./module";
import { authenticate } from "../utils/utils";
const router = Router();

router.post(`/create`,authenticate,async (req, res, next) => {
    try {
        res.status(OK).send(await createConstant(req.body));
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.get(`/groupBy`,authenticate, async (req, res, next) => {
    try {
        res.status(OK).send(await getConstantsGroupBy())
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.post("/update", authenticate,async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(OK).send(await addConstants(req.body));
    } catch (err) {
        next(new APIError(err.message));
    };
})

router.get("/list", async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(OK).send(await constantsList());
    } catch (err) {
        next(new APIError(err.message));
    };
})

router.post('/keyValues', async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(OK).send(await getConstantsAndValues(req.body.constantKeys));
    } catch (err) {
        next(new APIError(err.message));
    };
})
export = router