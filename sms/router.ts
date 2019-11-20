import { Router, Request, Response, NextFunction, Handler } from "express";
import { authenticate } from "../utils/utils";
import { smsTemplateCreate, smsTemplateEdit, smsTemplateDelete, smsTemplateGet, getSmsTemplateBySubstitutions, list } from "./module";
import { APIError } from "../utils/custom-error";
import { OK } from "http-status-codes";
const router = Router();

router.post(`/getTemplateBySubstitution`, async (req, res, next) => {
    try {
        res.status(OK).send(await getSmsTemplateBySubstitutions(req.body.templateId, req.body))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.post("/create", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(OK).send(await smsTemplateCreate(req.body));
    } catch (err) {
        if(err.code == 11000){
            err.message = `Sms template already exists`
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
        res.status(OK).send(await smsTemplateEdit(req.body, req.params.id));
    } catch (err) {
        if(err.code == 11000){
            err.message = `Sms template already exists`
        }
        next(new APIError(err.message));
    };
})
router.get("/delete/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(OK).send(await smsTemplateDelete(req.body, req.params.id));
    } catch (err) {
        next(new APIError(err.message));
    };
})
router.get("/getTemplate/:id", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(OK).send(await smsTemplateGet(req.params.id));
    } catch (err) {
        next(new APIError(err.message));
    };
})

export = router;
