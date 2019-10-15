import { Router, Request, Response, NextFunction,Handler } from "express";
import { authenticate } from "../utils/utils";
import { templateCreate, templateEdit, templateDelete, templateGet } from "./module";
const router = Router();


router.post("/create", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await templateCreate(req.body));
    } catch (err) {
        next(err);
    };
})
router.post("/edit/:id",authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await templateEdit(req.body,req.params.id));
    } catch (err) {
        next(err);
    };
})
router.get("/delete/:id",authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await templateDelete(req.body,req.params.id));
    } catch (err) {
        next(err);
    };
})
router.get("/getTemplate/:id",authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(200).send(await templateGet(req.params.id));
    } catch (err) {
        next(err);
    };
})

export = router;
