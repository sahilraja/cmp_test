import { Router, Request, Response, Handler } from "express";
import { role_list, userRoleAndScope, usersForRole } from "./module";
const router = Router();

//  list roles
router.get('/list', async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await role_list());
    } catch (err) {
        res.status(400).send({ error: err.message });
    };
});

//  list roles
router.get('/scope/list/:userid', async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await userRoleAndScope(req.params.userid));
    } catch (err) {
        res.status(400).send({ error: err.message });
    };
});

router.get("/user/list", async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await usersForRole(req.query.role))
    } catch (err) {
        res.status(400).send({ error: err.message })
    }
})


export = router;