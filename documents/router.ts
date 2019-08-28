import { Router } from "express"
import { getDocList, getDocListOfMe, createFile, createDOC } from "./module";
const router = Router()
var multer = require('multer')
var upload = multer()

router.post("/create", async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await createDOC(req.body, res.locals.user.id))
    } catch (err) {
        res.status(400).send({ error: err.message })
    };
});

router.post("/list", async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await getDocList())
    } catch (err) {
        res.status(400).send({ error: err.message })
    };
});

router.post("/me", async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await getDocListOfMe(res.locals.user.id))
    } catch (err) {
        res.status(400).send({ error: err.message })
    };
});

router.post("/:id/versions/:versionId:/file", upload.single('uploadefile'), async (req: any, res: any, next: any) => {
    try {
        const { docId, versionId } = req.params
        res.status(200).send(await createFile(docId, versionId, req.file))
    } catch (err) {
        res.status(400).send({ error: err.message })
    };
});

export = router;