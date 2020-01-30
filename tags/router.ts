import { Router, Request, Response, Handler } from "express";
import { tag_list, mergeTags } from "./module";
import { APIError } from "../utils/custom-error";
import { authenticate } from "../utils/utils";
const router = Router();

//  list of tag
router.get("/list", async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await tag_list(req.query.search))
    } catch (err) {
        next(new APIError(err.message));
    }
});

// Merge tags
router.post("/merge",authenticate, async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await mergeTags(req.body, req.token,res.locals.user._id,`${req.protocol}://${req.get('host')}`))
    } catch (err) {
        next(new APIError(err.message));
    }
});


export = router;