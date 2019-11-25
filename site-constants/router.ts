import { Router, Request, Response, NextFunction, Handler } from "express";
import { OK } from "http-status-codes";
import { constantSchema } from "./model";
import { APIError } from "../utils/custom-error";
import { constantsList, addConstants, createConstant, getConstantsGroupBy } from "./module";
const router = Router();

router.post(`/create`, async (req, res, next) => {
    try {
        res.status(OK).send(await createConstant(req.body))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.get(`/groupBy`, async (req, res, next) => {
    try {
        res.status(OK).send(await getConstantsGroupBy())
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.post("/update", async (req: Request, res: Response, next: NextFunction) => {
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

export = router