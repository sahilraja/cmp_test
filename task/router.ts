import { Router } from "express";
import * as proxy from "express-http-proxy";
import { authenticate } from "../utils/utils";
const router = Router();
const TASK_HOST = process.env.TASK_URL || "http://localhost:5052";

router.use('/', authenticate, proxy(TASK_HOST, {
    proxyReqPathResolver: ((req: any) => {
        return req.url;
    }),
    proxyReqOptDecorator: async function (proxyReqOpts: any, srcReq: any) {
        // you can update headers
        proxyReqOpts.headers['Content-Type'] = 'application/json';
        proxyReqOpts.headers['Authorization'] = srcReq.headers.authorization;
        proxyReqOpts.headers['Accept'] = 'application/json';
        return proxyReqOpts;
    }
}));

export = router;