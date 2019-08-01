import { Router, Request, Response, Handler } from "express";
import { OK } from "http-status-codes";
import { list } from "./module";

const router = Router();

router.get('/', async (req: Request, res: Response, next: Handler) => {
    res.status(OK).send(await list());
});

export = router;