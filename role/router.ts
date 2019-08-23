import { Router, Request, Response, Handler } from "express";
import { add_role, role_list, role_edit, role_status } from "./module";

const router = Router();

//  Add role
router.get('/add', async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await add_role(req.body));
    } catch (err) {
        res.status(400).send({ status: false, error: err.message });
    };
});

//  list roles
router.get('/list', async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await role_list());
    } catch (err) {
        res.status(400).send({ status: false, error: err.message });
    };
});

//  Edit Role
router.get('/edit/:id', async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await role_edit(req.params.id, req.body));
    } catch (err) {
        res.status(400).send({ status: false, error: err.message });
    };
});

//  Change Statue
router.get('/status/:id', async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await role_status(req.params.id));
    } catch (err) {
        res.status(400).send({ status: false, error: err.message });
    };
});

export = router;