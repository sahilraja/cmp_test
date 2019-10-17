import { Router, RequestHandler, NextFunction } from "express";
import {
  getDocList,
  getDocListOfMe,
  createFile,
  createDoc,
  submit,
  createNewVersion,
  ApproveDoc,
  RejectDoc,
  getDocDetails,
  getDocWithVersion,
  updateDoc,
  uploadToFileService,
  approvalList,
  getDocumentById,
  getDocumentVersionById,
  getVersions,
  getApprovalDoc,
  addCollaborator,
  removeCollaborator,
  addViewers,
  removeViewers,
  viewerList,
  collaboratorList,
  sharedList,
  invitePeople,
  invitePeopleList,
  invitePeopleEdit,
  invitePeopleRemove,
  docCapabilities,
  published,
  unPublished,
  replaceDoc,
  publishList,
  docFilter
} from "./module";
import { get as httpGet } from "http";
import { get as httpsGet } from "https";
import { authenticate } from "../utils/utils";
import { FILES_SERVER_BASE } from "../utils/urls";
import { APIError } from "../utils/custom-error";

const router = Router();

const ensureCanViewDocument: RequestHandler = (req, res, next) => {
  const documentId = req.params.id;
  next();
};

const ensureCanViewVersion: RequestHandler = (req, res, next) => {
  const documentId = req.params.id;
  //Make sure this is either CS or owner.
  next();
};

const ensureCanEditDocument: RequestHandler = (req, res, next) => {
  const documentId = req.params.id;
  const userId = res.locals.user._id;
  //if (userId not allowed to documentId)
  // return next(new Error("Not authorized to perform actions on this document"));
  //else
  next();
};

const ensureCanPublishDocument: RequestHandler = (req, res, next) => {
  const documentId = req.params.id;
  const userId = res.locals.user._id;
  //if (userId not allowed to publish documentId)
  // return next(new Error())
  //else
  next();
};

router.param("id", async (req, res, next, value) => {
  const documentId = req.params.id;
  try {
    const doc = await getDocumentById(documentId);
    next();
  } catch (err) {
    return next(err);
  }
});

//  Create Document
router.post("/create", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await createDoc(req.body, res.locals.user._id));
  } catch (err) {
    next(new APIError(err));
  }
});

//  Get Public List
router.get("/list", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await getDocList());
  } catch (err) {
    next(err);
  }
});

// Get My shared list
router.get("/shared/me", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await sharedList(res.locals.user._id));
  } catch (err) {
    next(err);
  }
});

// Get My shared list
router.get(
  "/publish/list",
  authenticate,
  async (req, res, next: NextFunction) => {
    try {
      res.status(200).send(await publishList(res.locals.user._id));
    } catch (err) {
      next(err);
    }
  }
);

// Get My list
router.get("/me", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await getDocListOfMe(res.locals.user._id));
  } catch (err) {
    next(err);
  }
});

//  Get pending Approval parent Docs
router.get("/approvals", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await approvalList());
  } catch (err) {
    next(err);
  }
});

// get pending and Approval parent Docs
router.get(
  "/approvals/:id",
  authenticate,
  async (req, res, next: NextFunction) => {
    try {
      res.status(200).send(await getApprovalDoc(req.params.id));
    } catch (err) {
      next(err);
    }
  }
);

router.get("/search", authenticate, async (req, res, next: NextFunction) => {
  try {
    res
      .status(200)
      .send(await docFilter(req.query.filter, res.locals.user._id));
  } catch (err) {
    next(err);
  }
});

//  Create new Version
// router.post("/:id/versions/:versionId/create", authenticate, ensureCanEditDocument, async (req, res, next: NextFunction) => {
//     try {
//         const { id, versionId } = req.params
//         res.status(200).send(await createNewVersion(id, versionId, res.locals.user._id, req.body));
//     } catch (err) {
//         next(err);
//     };
// });

// get versions
router.get(
  "/:id/versions",
  authenticate,
  ensureCanPublishDocument,
  async (req, res, next: NextFunction) => {
    try {
      const { id } = req.params;
      res.status(200).send(await getVersions(id));
    } catch (err) {
      next(err);
    }
  }
);

// Publish a specific version to public.
// router.post("/:id/versions/:versionId/publish", authenticate, ensureCanPublishDocument, async (req, res, next: NextFunction) => {
//     try {
//         const { id, versionId } = req.params
//         res.status(200).send(await ApproveDoc(id, versionId))
//     } catch (err) {
//         next(err);
//     };
// });

// create File
// router.post("/:id/versions/:versionId/reject", authenticate, ensureCanPublishDocument, async (req, res, next: NextFunction) => {
//     try {
//         const { id, versionId } = req.params
//         res.status(200).send(await RejectDoc(id, versionId))
//     } catch (err) {
//         next(err);
//     };
// });

// Upload File for a version.
router.post(
  "/:id/file",
  authenticate,
  ensureCanEditDocument,
  async (req, res, next: NextFunction) => {
    try {
      const { id } = req.params;
      const fileObj = await uploadToFileService(req);
      let response = await createFile(id, fileObj);
      res.status(200).send(response);
    } catch (err) {
      next(err);
    }
  }
);

//Download a file for a given version.
// router.get("/:id/versions/:versionId/file", ensureCanViewDocument, async (request: any, response: any, next: NextFunction) => {
//     try {
//         const { id, versionId } = request.params;
//         const { fileId } = await getDocumentVersionById(id);
//         const req = httpGet(`${FILES_SERVER_BASE}/files/${fileId}`, (res: any) => {
//             response.writeHead(200, res.headers);
//             res.pipe(response);
//         });
//         req.on('error', (e: Error) => {
//             next(e);
//         });
//         req.end();
//     } catch (err) {
//         next(err);
//     };
// });

//Download a file for a given document id
router.get(
  "/:id/file",
  ensureCanViewDocument,
  async (request: any, response: any, next: NextFunction) => {
    try {
      const { id } = request.params;
      const { fileId } = await getDocumentById(id);
      // const fileId = '5d66b64f7690505a261ab0fd';
      const req = (FILES_SERVER_BASE as string).startsWith("https")
        ? httpsGet(`${FILES_SERVER_BASE}/files/${fileId}`, (res: any) => {
            response.writeHead(200, res.headers);
            res.pipe(response);
          })
        : httpGet(`${FILES_SERVER_BASE}/files/${fileId}`, (res: any) => {
            response.writeHead(200, res.headers);
            res.pipe(response);
          });
      req.on("error", (e: Error) => {
        next(e);
      });
      req.end();
    } catch (err) {
      next(err);
    }
  }
);

//  Submit for approval
router.put(
  "/:id/submit",
  authenticate,
  ensureCanEditDocument,
  async (req, res, next: NextFunction) => {
    try {
      res.status(200).send(await submit(req.params.id));
    } catch (err) {
      next(err);
    }
  }
);

//  Get Document Details with versions
// router.get("/:id/versions/:versionId", authenticate, ensureCanViewDocument, async (req, res, next: NextFunction) => {
//     try {
//         res.status(200).send(await getDocWithVersion(req.params.id, req.params.versionId));
//     } catch (err) {
//         next(err);
//     };
// });

//  Add collaborators
router.post(
  "/:id/collaborator/add",
  authenticate,
  async (req, res, next: NextFunction) => {
    try {
      res
        .status(200)
        .send(await addCollaborator(req.params.id, req.body.collaborators));
    } catch (err) {
      next(err);
    }
  }
);

//  remove collaborators
router.put(
  "/:id/collaborator/remove",
  authenticate,
  async (req, res, next: NextFunction) => {
    try {
      res
        .status(200)
        .send(await removeCollaborator(req.params.id, req.body.collaborators));
    } catch (err) {
      next(err);
    }
  }
);

//  Add viewers
router.post(
  "/:id/viewer/add",
  authenticate,
  async (req, res, next: NextFunction) => {
    try {
      res.status(200).send(await addViewers(req.params.id, req.body.viewers));
    } catch (err) {
      next(err);
    }
  }
);

//  remove viewers
router.put(
  "/:id/viewer/remove",
  authenticate,
  async (req, res, next: NextFunction) => {
    try {
      res
        .status(200)
        .send(await removeViewers(req.params.id, req.body.viewers));
    } catch (err) {
      next(err);
    }
  }
);

//  viewers list
router.get(
  "/:id/viewer/list",
  authenticate,
  async (req, res, next: NextFunction) => {
    try {
      res.status(200).send(await viewerList(req.params.id));
    } catch (err) {
      next(err);
    }
  }
);

//  collaborators list
router.get(
  "/:id/collaborator/list",
  authenticate,
  async (req, res, next: NextFunction) => {
    try {
      res.status(200).send(await collaboratorList(req.params.id));
    } catch (err) {
      next(err);
    }
  }
);

//  invite user
router.post(
  "/:id/share",
  authenticate,
  async (req, res, next: NextFunction) => {
    try {
      res
        .status(200)
        .send(
          await invitePeople(req.params.id, req.body.users, req.query.role)
        );
    } catch (err) {
      next(err);
    }
  }
);

//  invite user list
router.get(
  "/:id/share/list",
  authenticate,
  async (req, res, next: NextFunction) => {
    try {
      res.status(200).send(await invitePeopleList(req.params.id));
    } catch (err) {
      next(err);
    }
  }
);

//  invite user edit
router.put(
  "/:id/share/:type/:userId/edit",
  authenticate,
  async (req, res, next: NextFunction) => {
    try {
      const { id, type, userId } = req.params;
      res
        .status(200)
        .send(await invitePeopleEdit(id, userId, type, req.query.role));
    } catch (err) {
      next(err);
    }
  }
);

//  invite user edit
router.delete(
  "/:id/share/:type/:userId/remove",
  authenticate,
  async (req, res, next: NextFunction) => {
    try {
      const { id, type, userId } = req.params;
      res
        .status(200)
        .send(await invitePeopleRemove(id, userId, type, req.query.role));
    } catch (err) {
      next(err);
    }
  }
);

//  update exist doc
router.get(
  "/:id/capabilities",
  authenticate,
  async (req, res, next: NextFunction) => {
    try {
      res
        .status(200)
        .send(await docCapabilities(req.params.id, res.locals.user._id));
    } catch (err) {
      next(err);
    }
  }
);

//  update exist doc
router.post(
  "/:id/publish",
  authenticate,
  async (req, res, next: NextFunction) => {
    try {
      res
        .status(200)
        .send(await published(req.body, req.params.id, res.locals.user._id));
    } catch (err) {
      next(err);
    }
  }
);

//  update exist doc
router.put(
  "/:id/unpublish",
  authenticate,
  async (req, res, next: NextFunction) => {
    try {
      res.status(200).send(await unPublished(req.params.id));
    } catch (err) {
      next(err);
    }
  }
);

//  update exist doc
router.post(
  "/:id/replace/:replaceDocId",
  authenticate,
  async (req, res, next: NextFunction) => {
    try {
      res
        .status(200)
        .send(
          await replaceDoc(
            req.params.id,
            req.params.replaceDocId,
            res.locals.user._id
          )
        );
    } catch (err) {
      next(err);
    }
  }
);

//  update exist doc
router.post(
  "/:id",
  authenticate,
  ensureCanEditDocument,
  async (req, res, next: NextFunction) => {
    try {
      res
        .status(200)
        .send(await updateDoc(req.body, req.params.id, res.locals.user._id));
    } catch (err) {
      next(err);
    }
  }
);

//  Get Document Details
router.get(
  "/:id",
  authenticate,
  ensureCanViewDocument,
  async (req, res, next: NextFunction) => {
    try {
      res.status(200).send(await getDocDetails(req.params.id));
    } catch (err) {
      next(err);
    }
  }
);

export = router;
