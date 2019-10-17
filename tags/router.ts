import { Router, Request, Response, Handler } from "express";
import { tag_list } from "./module";
import { APIError } from "../utils/custom-error";
const router = Router();

//  list of tag
router.get("/list", async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await tag_list(req.query.search))
    } catch (err) {
        next(new APIError(err.message));
    }
});

export = router;