import { Router, Request, Response, Handler, RequestHandler, NextFunction  } from "express";
import { addComment, commentsList } from "./module";
import { get as httpGet } from "http";
import { get as httpsGet } from "https";
import { authenticate } from "../utils/utils";
import { FILES_SERVER_BASE } from "../utils/urls";
import { APIError } from "../utils/custom-error";

const router = Router();

//  list roles
router.get('/list/:doc_id', async (req: Request, res: Response, next: Handler) => {
    try {
        let type = req.query.type?req.query.type:"document"
        res.status(200).send(await commentsList(req.params.doc_id,type));
    } catch (err) {
        res.status(400).send({ error: err.message });
    };
});
  
router.post('/add',authenticate, async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await addComment(req.body,res.locals.user, (req as any).token));
    } catch (err) {
        res.status(400).send({ error: err.message });
    };
});

export = router;