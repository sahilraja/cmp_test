import { Router } from "express";
import { APIError } from "../utils/custom-error";
import { OK } from "http-status-codes";
import { stepDetail, list } from "../steps/module";
import { FILES_SERVER_BASE } from "../utils/urls";
import { UploadFormatSchema } from "../project/upload-format-model";
import { get as httpGet } from "http";
import { get as httpsGet } from "https";
import { uploadToFileService } from "../documents/module";
const router = Router()

router.get(`/step-info`, async (req, res, next) =>  {
    try {
        res.status(OK).send(await stepDetail(req.params.stepId))
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.get(`/get-all-steps`, async (req, res, next) =>  {
    try {
        res.status(OK).send(await list())
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.post(`/upload-sample-excel`, async (req, res, next) => {
    try {
        let payload: any
        const contentType: any = req.get('content-type');
        if (contentType.includes('multipart/form-data')) {
            payload = await uploadToFileService(req)
        }
        payload = JSON.parse(payload)
        res.status(OK).send(await UploadFormatSchema.findOneAndUpdate({type:'TASK_EXCEL'},{type:'TASK_EXCEL', name:payload.name, fileId: payload.id}, {upsert: true}).exec())
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.get(`/download-bulk-task-excel`, async (request, response, next) => {
    const detail: any = await UploadFormatSchema.findOne({ type: 'TASK_EXCEL' }).exec()
    const req = (FILES_SERVER_BASE as string).startsWith("https") ?
        httpsGet(`${FILES_SERVER_BASE}/files/${detail.fileId}`, (res: any) => {
            response.setHeader('Content-disposition', `attachment;filename=${detail.name || `sample.csv`}`);
            response.setHeader('Content-type', res.headers['content-type'])
            res.pipe(response);
        }) : httpGet(`${FILES_SERVER_BASE}/files/${detail.fileId}`, (res: any) => {
            response.setHeader('Content-disposition', `attachment;filename=${detail.name || `sample.csv`}`);
            response.setHeader('Content-type', res.headers['content-type'])
            res.pipe(response);
        });
    req.on('error', (e: Error) => {
        next(e);
    });
    req.end();
})

router.post(`/upload-user-excel`, async (req, res, next) => {
    try {
        let payload: any
        const contentType: any = req.get('content-type');
        if (contentType.includes('multipart/form-data')) {
            payload = await uploadToFileService(req)
        }
        payload = JSON.parse(payload)
        res.status(OK).send(await UploadFormatSchema.findOneAndUpdate({type:'USER_EXCEL'},{type:'USER_EXCEL', name:payload.name, fileId: payload.id}, {upsert: true}).exec())
    } catch (error) {
        next(new APIError(error.message))
    }
})

router.get(`/download-bulk-user-excel`,async (request, response, next) => {
    const detail: any = await UploadFormatSchema.findOne({ type: 'USER_EXCEL' }).exec()
    const req = (FILES_SERVER_BASE as string).startsWith("https") ?
        httpsGet(`${FILES_SERVER_BASE}/files/${detail.fileId}`, (res: any) => {
            response.setHeader('Content-disposition', `attachment;filename=${detail.name || `sample.csv`}`);
            response.setHeader('Content-type', res.headers['content-type'])
            res.pipe(response);
        }) : httpGet(`${FILES_SERVER_BASE}/files/${detail.fileId}`, (res: any) => {
            response.setHeader('Content-disposition', `attachment;filename=${detail.name || `sample.csv`}`);
            response.setHeader('Content-type', res.headers['content-type'])
            res.pipe(response);
        });
    req.on('error', (e: Error) => {
        next(e);
    });
    req.end();
})

export = router