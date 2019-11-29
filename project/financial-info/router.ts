import { Router, Request, Response, Handler, NextFunction } from "express";
import { authenticate } from "../../utils/utils";
import { OK } from "http-status-codes";
import { APIError } from "../../utils/custom-error";
import { financialInfoCreate, financialInfoEdit, financialInfoList, financialInfoDelete, financialInfoDetails } from "./module";
const router = Router();

//  Create financial-info
router.post("/:id/financial-info/instalment/create", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        res.status(OK).send(await financialInfoCreate(req.body, req.params.id, res.locals.user))
    } catch (err) {
        next(new APIError(err.message));
    };
});

//  Edit financial-info
router.post("/:id/financial-info/:financialId/instalment/edit", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id: projectId, financialId } = req.params
        res.status(OK).send(await financialInfoEdit(projectId, financialId, req.body, res.locals.user))
    } catch (err) {
        next(new APIError(err.message));
    };
});

//  list financial-info
router.get("/:id/financial-info/instalment/list", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id: projectId } = req.params
        res.status(OK).send(await financialInfoList(projectId, res.locals.user))
    } catch (err) {
        next(new APIError(err.message));
    };
});

//  Delete financial-info
router.get("/:id/financial-info/:financialId/instalment/details", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id: projectId, financialId } = req.params
        res.status(OK).send(await financialInfoDetails(projectId, financialId, res.locals.user))
    } catch (err) {
        next(new APIError(err.message));
    };
});

//  Delete financial-info
router.post("/:id/financial-info/:financialId/instalment/delete", authenticate, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id: projectId, financialId } = req.params
        res.status(OK).send(await financialInfoDelete(projectId, financialId, res.locals.user))
    } catch (err) {
        next(new APIError(err.message));
    };
});

export = router;