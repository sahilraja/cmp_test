import { Router, Request, Response, NextFunction } from "express";
import { authenticate } from "../utils/utils";
import { APIError } from "../utils/custom-error";
import { Types } from "mongoose";
import { OK } from "http-status-codes";
import { createPrivateGroup, editPrivateGroup, privateGroupStatus, privateGroupList, privateGroupDetails } from "./module";
const router = Router();

//  Group Id Validation
router.param("id", async (req, res, next, value) => {
    const groupId: string = req.params.id;
    try {
        if (!Types.ObjectId.isValid(groupId)) throw new Error("GroupId is Invalid.")
        next();
    } catch (err) {
        next(new APIError(err.message));
    }
});

//  Create Private Group 
router.post("/create", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(OK).send(await createPrivateGroup(req.body, res.locals.user))
    } catch (err) {
        next(new APIError(err.message));
    };
});

//  Edit Private Group Details
router.post("/:id/edit", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(OK).send(await editPrivateGroup(req.params.id, req.body, res.locals.user._id))
    } catch (err) {
        next(new APIError(err.message));
    };
});

//  Change Status of the Private Group
router.put("/:id/status", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(OK).send(await privateGroupStatus(req.params.id, res.locals.user._id))
    } catch (err) {
        next(new APIError(err.message));
    };
});

//  Get List Private Group Deatils
router.get("/list", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(OK).send(await privateGroupList(res.locals.user._id, req.query.search))
    } catch (err) {
        next(new APIError(err.message));
    };
});

//  Get Private Group Details
router.get("/:id/details", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(OK).send(await privateGroupDetails(req.params.id))
    } catch (err) {
        next(new APIError(err.message));
    };
});
export = router;