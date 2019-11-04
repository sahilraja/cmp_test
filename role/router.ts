import { Router, Request, Response, Handler } from "express";
import { role_list, capabilities_list, updaterole,userRoleAndScope, usersForRole, capabilities, allrolecapabilities, addCapability,removeCapability,
    addRolesFromJSON,addRole ,addRoleCapabilitiesFromJSON} from "./module";
import { authenticate } from "../utils/utils";
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

router.get('/capabilities/list', async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await capabilities_list());
    } catch (err) {
        res.status(400).send({ error: err.message });
    };
});

router.get('/all/capabilities/list', async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await allrolecapabilities());
    } catch (err) {
        res.status(400).send({ error: err.message });
    };
});

router.post('/capability/add', async (req: Request, res: Response, next: Handler) => {
    try {
        let scope = 'global'
        res.status(200).send(await addCapability(req.body.role,scope,req.body.capability));
    } catch (err) {
        res.status(400).send({ error: err.message });
    };
});

router.put('/capability/remove', async (req: Request, res: Response, next: Handler) => {
    try {
        let scope = 'global'
        res.status(200).send(await removeCapability(req.body.role,scope,req.body.capability));
    } catch (err) {
        res.status(400).send({ error: err.message });
    };
});

router.put('/:role/edit', async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await updaterole(req.params.role,req.body));
    } catch (err) {
        res.status(400).send({ error: err.message });
    };
}); 

router.post('/addRoles', authenticate,async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await addRolesFromJSON(res.locals.user._id));
    } catch (err) {
        res.status(400).send({ error: err.message });
    };
}); 

router.post('/add', authenticate,async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await addRole(res.locals.user._id,req.body));
    } catch (err) {
        res.status(400).send({ error: err.message });
    };
}); 

router.post('/add/roleCapabilities', authenticate,async (req: Request, res: Response, next: Handler) => {
    try {
        res.status(200).send(await addRoleCapabilitiesFromJSON(res.locals.user._id));
    } catch (err) {
        res.status(400).send({ error: err.message });
    };
}); 
export = router;