import { Router, Request, Response, Handler } from "express";
import { add_capability, remove_capability, scope_capability_list } from "./module";

const router = Router();

//  add capability for role
router.post('/capabilities/add', async (req: Request, res: Response, next: Handler) => {
    try{
        res.status(200).send( await add_capability(req.body));
    }catch(err){
        res.status(400).send({status: false, error: err.message});
    };
});

//  remove capability for role
router.put('/capabilities/remove', async (req: Request, res: Response, next: Handler) => {
    try{
        res.status(200).send( await remove_capability(req.body));
    }catch(err){
        res.status(400).send({status: false, error: err.message});
    };
});

//  get list of capability of a scope
router.get('/capabilities/list', async (req: Request, res: Response, next: Handler) => {
    try{
        res.status(200).send( await scope_capability_list(req.query));
    }catch(err){
        res.status(400).send({status: false, error: err.message});
    };
});

export = router;