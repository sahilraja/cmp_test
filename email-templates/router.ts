import { Router, Request, Response, NextFunction, Handler } from "express";
import { authenticate } from "../utils/utils";
import { templateCreate, templateEdit, templateDelete, templateGet, getTemplateBySubstitutions, list, testTemplate } from "./module";
import { APIError } from "../utils/custom-error";
import { OK } from "http-status-codes";
const router = Router();

router.post(`/getTemplateBySubstitution`, async (req, res, next) => {
    try {
        res.status(OK).send(await getTemplateBySubstitutions(req.body.templateId, req.body))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.post("/create", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(OK).send(await templateCreate(req.body));
    } catch (err) {
        if (err.code == 11000) {
            err.message = `Template already exists`
        }
        next(new APIError(err.message));
    };
})

router.get(`/list`, authenticate, async (req, res, next) => {
    try {
        res.status(OK).send(await list())
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.post("/edit/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(OK).send(await templateEdit(res.locals.user, req.body, req.params.id));
    } catch (err) {
        if (err.code == 11000) {
            err.message = `Template already exists`
        }
        next(new APIError(err.message));
    };
})
router.get("/delete/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(OK).send(await templateDelete(req.body, req.params.id));
    } catch (err) {
        next(new APIError(err.message));
    };
})
router.get("/getTemplate/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(OK).send(await templateGet(res.locals.user, req.params.id));
    } catch (err) {
        next(new APIError(err.message));
    };
})

router.post("/testTemplate/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(OK).send(await testTemplate(req.params.id, req.body.email));
    } catch (err) {
        next(new APIError(err.message));
    };
})

export = router;
