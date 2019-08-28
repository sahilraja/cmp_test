import { Router } from "express"
import { getDocList, getDocListOfMe, createFile, createDOC, submit, createNewVersion, ApproveDoc, RejectDoc } from "./module";
const router = Router()

// impoet multer
var multer = require('multer')
var upload = multer()

//  Create Document
router.post("/create", async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await createDOC(req.body, res.locals.user.id))
    } catch (err) {
        res.status(400).send({ error: err.message })
    };
});

//  Get Public List
router.get("/list", async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await getDocList())
    } catch (err) {
        res.status(400).send({ error: err.message })
    };
});

// Get My list
router.get("/me", async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await getDocListOfMe(res.locals.user.id))
    } catch (err) {
        res.status(400).send({ error: err.message })
    };
});

//  Create new Version
router.post("/:id/versions/create", async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await createNewVersion(req.params.id, res.locals.user.id));
    } catch (error) {
        res.status(400).send({ err: error.message });
    };
});

// create File
router.post("/:id/versions/:versionId/publish", async (req: any, res: any, next: any) => {
    try {
        const { docId, versionId } = req.params
        res.status(200).send(await ApproveDoc(docId))
    } catch (err) {
        res.status(400).send({ error: err.message })
    };
});

// create File
router.post("/:id/versions/:versionId/reject", async (req: any, res: any, next: any) => {
    try {
        const { docId, versionId } = req.params
        res.status(200).send(await RejectDoc(docId))
    } catch (err) {
        res.status(400).send({ error: err.message })
    };
});

// create File
router.post("/:id/versions/:versionId:/file", upload.single('uploadefile'), async (req: any, res: any, next: any) => {
    try {
        const { docId, versionId } = req.params
        res.status(200).send(await createFile(docId, versionId, req.file))
    } catch (err) {
        res.status(400).send({ error: err.message })
    };
});

//  Submit for approval
router.post("/:id/versions/:versionId/submit", async (req: any, res: any, next: any) => {
    try {
        res.status(200).send(await submit(req.params.id, req.params.versionId));
    } catch (error) {
        res.status(400).send({ err: error.message });
    };
});


export = router;