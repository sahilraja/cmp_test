import { Router, Request, Response, Handler } from "express";
import { add_role, revoke_role, get_roles } from "./module";

const router = Router();

//  add role to the user
router.post('/role/add/:id', async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await add_role(req.params.id, req.body));
    } catch (err) {
        res.status(400).send({ status: false, error: err.message })
    };
});

//  revoke role to the user
router.put('/role/revoke/:id', async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await revoke_role(req.params.id, req.body));
    } catch (err) {
        res.status(400).send({ status: false, error: err.message })
    };
});

//  role of the user
router.get('/roles/:id', async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await get_roles(req.params.id, req.query));
    } catch (err) {
        res.status(400).send({ status: false, error: err.message })
    };
});

export = router;