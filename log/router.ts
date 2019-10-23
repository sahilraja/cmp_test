import { Router } from "express";
import { OK } from "http-status-codes";
import { paginatedList, create, list } from "./module";
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

export = router