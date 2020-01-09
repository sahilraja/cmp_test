import { Router, Request, Response, Handler } from "express";
import {
    role_list, capabilities_list, updaterole, userRoleAndScope, usersForRole, capabilities, allrolecapabilities, addCapability, removeCapability,
    addRolesFromJSON, addRole, addRoleCapabilitiesFromJSON
} from "./module";
import { authenticate } from "../utils/utils";
import { APIError } from "../utils/custom-error";
import { NextFunction } from "connect";
const router = Router();

//  list roles
router.get('/list', authenticate, async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await role_list());
    } catch (err) {
        res.status(400).send({ error: err.message });
    };
});

//  list roles
router.get('/scope/list/:userid', authenticate, async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await userRoleAndScope(req.params.userid));
    } catch (err) {
        res.status(400).send({ error: err.message });
    };
});

router.get("/user/list", authenticate, async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await usersForRole(req.query.role))
    } catch (err) {
        res.status(400).send({ error: err.message })
    }
})

router.get('/capabilities/list', authenticate, async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await capabilities_list());
    } catch (err) {
        res.status(400).send({ error: err.message });
    };
});

router.get('/all/capabilities/list', authenticate, async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await allrolecapabilities());
    } catch (err) {
        res.status(400).send({ error: err.message });
    };
});

router.post('/capability/add', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        let scope = 'global'
        res.status(200).send(await addCapability(req.body.role, scope, req.body.capability, res.locals.user._id, req.query.auth));
    } catch (err) {
        next(new APIError(err.message, 409))
    };
});

router.post('/capability/add/no-auth', async (req: Request, res: Response, next: NextFunction) => {
    try {
        let scope = 'global'
        res.status(200).send(await addCapability(req.body.role, scope, req.body.capability, "", false));
    } catch (err) {
        next(new APIError(err.message, 409))
    };
});

router.put('/capability/remove', authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        let scope = 'global'
        res.status(200).send(await removeCapability(req.body.role, scope, req.body.capability, res.locals.user._id));
    } catch (err) {
        next(new APIError(err.message, 409))
    };
});

router.put('/:role/edit', authenticate, async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await updaterole(req.params.role, req.body, res.locals.user._id));
    } catch (err) {
        res.status(400).send({ error: err.message });
    };
});

router.post('/addRoles', async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await addRolesFromJSON());
    } catch (err) {
        res.status(400).send({ error: err.message });
    };
});

router.post('/add', authenticate, async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await addRole(res.locals.user._id, req.body));
    } catch (err) {
        res.status(400).send({ error: err.message });
    };
});

router.post('/add/roleCapabilities', authenticate, async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await addRoleCapabilitiesFromJSON(res.locals.user._id));
    } catch (err) {
        res.status(400).send({ error: err.message });
    };
});
export = router;