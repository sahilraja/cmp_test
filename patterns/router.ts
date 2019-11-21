import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../utils/utils";
import { APIError } from "../utils/custom-error";
import { Types } from "mongoose";
import { OK } from "http-status-codes";
import { patternCreate, patternEdit, patternDelete, patternList, patternDetails, patternSubstitutions } from "./module";
const router = Router();

//  Pattern Id Validation
router.param("id", async (req, res, next, value) => {
    const patternId: string = req.params.id;
    try {
        if (!Types.ObjectId.isValid(patternId)) throw new Error("Invalid pattern Id.")
        next();
    } catch (err) {
        next(new APIError(err.message));
    };
});

//  Create patterns
router.post("/create", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(OK).send(await patternCreate(req.body, res.locals.user))
    } catch (err) {
        next(new APIError(err.message));
    };
});

//  Get pattern list
router.get("/list", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(OK).send(await patternList(res.locals.user, req.query.search))
    } catch (err) {
        next(new APIError(err.message));
    };
});

//  Get pattern list
router.post("/message-modification", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(OK).send(await patternSubstitutions(req.body.message))
    } catch (err) {
        next(new APIError(err.message));
    };
});

//  Edit pattern
router.post("/:id/edit", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(OK).send(await patternEdit(req.params.id, req.body, res.locals.user))
    } catch (err) {
        next(new APIError(err.message));
    };
});

//  Pattern Delete
router.put("/:id/delete", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(OK).send(await patternDelete(req.params.id, res.locals.user))
    } catch (err) {
        next(new APIError(err.message));
    };
});

//  Get Pattern Details
router.get("/:id/details", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(OK).send(await patternDetails(req.params.id))
    } catch (err) {
        next(new APIError(err.message));
    };
});
export = router;