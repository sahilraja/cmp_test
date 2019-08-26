import { Router, Request, Response, Handler } from "express";
import { role_list } from "./module";

const router = Router();

//  list roles
router.get('/list', async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await role_list());
    } catch (err) {
        res.status(400).send({ error: err.message });
    };
});


export = router;