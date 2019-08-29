import { Router, RequestHandler, NextFunction } from "express"
import { getDocList, getDocListOfMe, createFile, createDOC, submit, createNewVersion, ApproveDoc, RejectDoc, getDocDetails, getDocWithVersion, updateDoc, uploadToFileService,approvalList, getDocumentById, getDocumentVersionById } from "./module";
import { get as httpGet } from "http";

const router = Router()

const FILES_SERVER_BASE = process.env.FILES_SERVER_BASE || "http://localhost:4040";

const ensureCanViewDocument: RequestHandler = (req, res, next) => {
    const documentId = req.params.id;
    next();
}

const ensureCanViewVersion: RequestHandler = (req, res, next) => {
    const documentId = req.params.id;
    //Make sure this is either CS or owner.
    next();
}


const ensureCanEditDocument: RequestHandler = (req, res, next) => {
    const documentId = req.params.id;
    const userId = res.locals.user.id;
    //if (userId not allowed to documentId)
    // return next(new Error("Not authorized to perform actions on this document"));
    //else
    next();
}

const ensureCanPublishDocument: RequestHandler = (req, res, next) => {
    const documentId = req.params.id;
    const userId = res.locals.user.id;
    //if (userId not allowed to publish documentId)
    // return next(new Error())
    //else
    next();
}

router.param('id', async (req, res, next, value) => {
    const documentId = req.params.id;
    try {
        const doc = await getDocumentById(documentId);
        next();
    } catch (err) {
        return next(err);
    }
});

router.param('versionId', async (req, res, next, value) => {
    const versionId = req.params.versionId;
    const documentId = req.params.id;
    //TODO: Check if the document has this version.
    try {
        const doc = await getDocumentVersionById(versionId);
        next();
    } catch (err) {
        return next(err);
    }
});

//  Create Document
router.post("/create", async (req, res, next: NextFunction) => {
    try {
        res.status(200).send(await createDOC(req.body, res.locals.user.id));
    } catch (err) {
        next(err);
    };
});

//  Get Public List
router.get("/list", async (req, res, next: NextFunction) => {
    try {
        res.status(200).send(await getDocList())
    } catch (err) {
        next(err);
    };
});

// Get My list
router.get("/me", async (req, res, next: NextFunction) => {
    try {
        res.status(200).send(await getDocListOfMe(res.locals.user.id))
    } catch (err) {
        next(err);
    };
});

//  Get pending Approval parent Docs
router.get("/approvals", async (req, res, next: NextFunction) => {
    try {
        res.status(200).send(await approvalList());
    } catch (err) {
        next(err);
    };
});

//  Create new Version
router.post("/versions/:versionId/create", ensureCanEditDocument, async (req, res, next: NextFunction) => {
    try {
        res.status(200).send(await createNewVersion(req.params.id, res.locals.user.id,req.body));
    } catch (err) {
        next(err);
    };
});

// Publish a specific version to public.
router.post("/:id/versions/:versionId/publish", ensureCanPublishDocument, async (req, res, next: NextFunction) => {
    try {
        const { docId, versionId } = req.params
        res.status(200).send(await ApproveDoc(docId))
    } catch (err) {
        next(err);
    };
});

// create File
router.post("/:id/versions/:versionId/reject", ensureCanPublishDocument, async (req, res, next: NextFunction) => {
    try {
        const { docId, versionId } = req.params
        res.status(200).send(await RejectDoc(docId))
    } catch (err) {
        next(err);
    };
});

// Upload File for a version.
router.post("/:id/versions/:versionId/file", ensureCanEditDocument, async (req, res, next: NextFunction) => {
    try {
        const { id, versionId } = req.params;
        const fileObj = await uploadToFileService(req);
        let response = await createFile(versionId,fileObj);
        res.status(200).send(response);
    } catch (err) {
        next(err);
    };
});

//Download a file for a given version.
router.get("/:id/versions/:versionId/file", ensureCanViewDocument, async (request: any, response: any, next: NextFunction) => {
    try {
        const { id, versionId } = request.params;
        const { fileId } = await getDocumentVersionById(id);
        const req = httpGet( `${FILES_SERVER_BASE}/files/${fileId}`, (res : any) => {
            response.writeHead(200, res.headers);
            res.pipe(response);
        });
        req.on('error', (e : Error) => {
            next(e);
        });
        req.end();
    } catch (err) {
        next(err);
    };
});

//Download a file for a given document id
router.get("/:id/file", ensureCanViewDocument ,async (request: any, response: any, next: NextFunction) => {
    try {
        const { id } = request.params;
        // const { fileId } = await getDocumentById(id);
        const fileId = '5d66b64f7690505a261ab0fd';
        const req = httpGet( `${FILES_SERVER_BASE}/files/${fileId}`, (res : any) => {
            response.writeHead(200, res.headers);
            res.pipe(response);
        });
        req.on('error', (e : Error) => {
            next(e);
        });
        req.end();
    } catch (err) {
        next(err);
    };
});

//  Submit for approval
router.post("/:id/versions/:versionId/submit", ensureCanEditDocument, async (req, res, next: NextFunction) => {
    try {
        res.status(200).send(await submit(req.params.id, req.params.versionId));
    } catch (err) {
        next(err);
    };
});

//  Get Document Details with versions
router.get("/:id/versions/:versionId", ensureCanViewDocument, async (req, res, next: NextFunction) => {
    try {
        res.status(200).send(await getDocWithVersion(req.params.id, req.params.versionId));
    } catch (err) {
        next(err);
    };
});

//  update exist doc
router.post("/:id/versions/:versionId", ensureCanEditDocument, async (req, res, next: NextFunction) => {
    try {
        res.status(200).send(await updateDoc(req.body, req.params.id, req.params.versionId));
    } catch (err) {
        next(err);
    };
});


//  Get Document Details
router.get("/:id", ensureCanViewDocument, async (req, res, next: NextFunction) => {
    try {
        res.status(200).send(await getDocDetails(req.params.id));
    } catch (err) {
        next(err);
    };
});

export = router;