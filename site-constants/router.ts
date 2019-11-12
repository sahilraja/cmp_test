import { Router, Request, Response, NextFunction, Handler } from "express";
import { OK } from "http-status-codes";
import { constantSchema } from "./model";
import { APIError } from "../utils/custom-error";
import { constantsList, addConstants } from "./module";
const router = Router();


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