import { Router } from "express";
import { OK } from "http-status-codes";
import { paginatedList, create, list, getTaskLogs } from "./module";
import { APIError } from "../utils/custom-error";
import { authenticate } from "../utils/utils";
const router = Router()

router.post('/create', async (req, res, next) => {
    try {
        res.status(OK).send(await create(req.body))
    } catch (error) {
        next(error)
    }
})

router.post(`/list`, async (req, res, next) => {
    try {
        res.status(OK).send(await list(req.body))        
    } catch (error) {
        next(error)
    }
})

router.post(`/paginated-list`, async (req, res, next) => {
    try {
        res.status(OK).send(await paginatedList(req.body, req.query.page, req.query.limit))
    } catch (error) {
        next(error)
    }
})

router.get(`/get-task-logs`, authenticate, async (req, res, next) => {
    try {
        res.status(OK).send(await getTaskLogs(req.query.taskId, (req as  any).token))
    } catch (error) {
        next(new APIError(error.message))
    }
})
export = router