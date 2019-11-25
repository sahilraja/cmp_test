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
  docFilter,
  createNewDoc,
  createFolder,
  moveToFolder,
  listFolders,
  getFolderDetails,
  deleteFolder,
  documentsList,
  updateDocNew,
  documnetCapabilities,
  deleteDoc,
  getListOfFoldersAndFiles,
  checkCapabilitiesForUser,
  shareDocForUsers,
  suggestTags,
  approveTags,
  rejectTags,
  getAllTags,
  allDocuments,
  cancelUpdate,
  deleteSuggestedTag,
  getAllRequest,
  requestAccept,
  requestDenied,
  requestRaise,
  getAllCmpDocs,
  getAllPublicDocuments,
  markDocumentAsPublic
} from "./module";

import { get as httpGet } from "http";
import { get as httpsGet } from "https";
import { authenticate } from "../utils/utils";
import { FILES_SERVER_BASE } from "../utils/urls";
import { APIError } from "../utils/custom-error";
import { DOCUMENT_ROUTER } from "../utils/error_msg";
import { checkRoleScope } from "../utils/role_management";
import { constantSchema } from "../site-constants/model";
import { OK } from "http-status-codes";

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

const siteConstants: RequestHandler = async (req: any, res, next) => {
  let siteConstants: any = await constantSchema.findOne().exec();
  req.siteConstants = siteConstants.toJSON()
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
    next(new APIError(err.message));
  }
});

//  Create Document
router.post("/create", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await createDoc(req.body, res.locals.user._id));
  } catch (err) {
    next(new APIError(err.message));
  }
});

//  Create Document new Api
router.post("/create/new", authenticate, siteConstants, async (req: any, res, next: NextFunction) => {
  try {
    const isEligible = await checkRoleScope(res.locals.user.role, "create-doc");
    if (!isEligible) throw new Error(DOCUMENT_ROUTER.NO_PERMISSION);
    const fileObj: any = JSON.parse(await uploadToFileService(req) as any)
    res.status(200).send(await createNewDoc(fileObj, res.locals.user._id, req.siteConstants));
  } catch (err) {
    next(new APIError(err.message));
  }
});


//  Get Public List
router.get("/list", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await getDocList(req.query.page, req.query.limit, `${req.protocol}://${req.get('host')}`));
  } catch (err) {
    next(new APIError(err.message));
  }
});

// Get My shared list
router.get("/shared/me", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await sharedList(res.locals.user._id, req.query.page, req.query.limit, `${req.protocol}://${req.get('host')}`));
  } catch (err) {
    next(new APIError(err.message));
  }
});

// Get My shared list
router.get("/publish/list", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await publishList(res.locals.user._id, req.query.page, req.query.limit, `${req.protocol}://${req.get('host')}`));
  } catch (err) {
    next(new APIError(err.message));
  }
}
);

// Get My shared list
router.get("/all/list", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await allDocuments(res.locals.user._id, req.query.page, req.query.limit, `${req.protocol}://${req.get('host')}`));
  } catch (err) {
    next(new APIError(err.message));
  }
}
);

// Get My list
router.get("/me", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await getDocListOfMe(res.locals.user._id, req.query.page, req.query.limit, `${req.protocol}://${req.get('host')}`));
  } catch (err) {
    next(new APIError(err.message));
  }
});

//  Get pending Approval parent Docs
router.get("/approvals", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await approvalList(`${req.protocol}://${req.get('host')}`));
  } catch (err) {
    next(new APIError(err.message));
  }
});

// get pending and Approval parent Docs
router.get("/approvals/:id", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await getApprovalDoc(req.params.id));
  } catch (err) {
    next(new APIError(err.message));
  }
}
);

router.get("/search", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await docFilter(req.query.filter, res.locals.user._id, req.query.page, req.query.limit, `${req.protocol}://${req.get('host')}`));
  } catch (err) {
    next(new APIError(err.message));
  }
});

router.post("/user-capabilities", authenticate, async (req, res, next) => {
  try {
    res.status(200).send(await checkCapabilitiesForUser(req.body, res.locals.user._id))
  } catch (err) {
    next(new APIError(err.message));
  };
});

router.post("/add-user-capabilities", authenticate, async (req, res, next) => {
  try {
    res.status(200).send(await shareDocForUsers(req.body))
  } catch (err) {
    next(new APIError(err.message));
  };
});

router.get(`/get-document/:docId`, async (request, response, next) => {
  try {
    const req = (FILES_SERVER_BASE as string).startsWith("https") ?
      httpsGet(`${FILES_SERVER_BASE}/compressed-image/${request.params.docId}`, (res: any) => {
        response.setHeader('Content-disposition', 'inline');
        response.setHeader('Content-type', res.headers['content-type'])
        res.pipe(response);
      }) : httpGet(`${FILES_SERVER_BASE}/compressed-image/${request.params.docId}`, (res: any) => {
        response.setHeader('Content-disposition', 'inline');
        response.setHeader('Content-type', res.headers['content-type'])
        res.pipe(response);
      });
    req.on('error', (e: Error) => {
      next(e);
    });
    req.end();
  } catch (err) {
    next(new APIError(err.message));
  };
});


//  Create new Version
// router.post("/:id/versions/:versionId/create", authenticate, ensureCanEditDocument, async (req, res, next: NextFunction) => {
//     try {
//         const { id, versionId } = req.params
//         res.status(200).send(await createNewVersion(id, versionId, res.locals.user._id, req.body));
//     } catch (err) {
//         next(new APIError(err.message));
//     };
// });

// get versions
router.get("/:id/versions", authenticate, ensureCanPublishDocument, async (req, res, next: NextFunction) => {
  try {
    const { id } = req.params;
    res.status(200).send(await getVersions(id));
  } catch (err) {
    next(new APIError(err.message));
  }
}
);

// Publish a specific version to public.
// router.post("/:id/versions/:versionId/publish", authenticate, ensureCanPublishDocument, async (req, res, next: NextFunction) => {
//     try {
//         const { id, versionId } = req.params
//         res.status(200).send(await ApproveDoc(id, versionId))
//     } catch (err) {
//         next(new APIError(err.message));
//     };
// });

// create File
// router.post("/:id/versions/:versionId/reject", authenticate, ensureCanPublishDocument, async (req, res, next: NextFunction) => {
//     try {
//         const { id, versionId } = req.params
//         res.status(200).send(await RejectDoc(id, versionId))
//     } catch (err) {
//         next(new APIError(err.message));
//     };
// });

// Upload File for a version.
router.post("/:id/file", authenticate, ensureCanEditDocument, async (req, res, next: NextFunction) => {
  try {
    const { id } = req.params;
    const fileObj = await uploadToFileService(req);
    let response = await createFile(id, fileObj);
    res.status(200).send(response);
  } catch (err) {
    next(new APIError(err.message));
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
//         next(new APIError(err.message));
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
      next(new APIError(err.message));
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
      next(new APIError(err.message));
    }
  }
);

//  Get Document Details with versions
// router.get("/:id/versions/:versionId", authenticate, ensureCanViewDocument, async (req, res, next: NextFunction) => {
//     try {
//         res.status(200).send(await getDocWithVersion(req.params.id, req.params.versionId));
//     } catch (err) {
//         next(new APIError(err.message));;
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
      next(new APIError(err.message));
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
      next(new APIError(err.message));
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
      next(new APIError(err.message));
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
      next(new APIError(err.message));
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
      next(new APIError(err.message));
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
      next(new APIError(err.message));
    }
  }
);

//  invite user
router.post("/:id/share", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await invitePeople(req.params.id, req.body.users, req.query.role, res.locals.user._id));
  } catch (err) {
    next(new APIError(err.message));
  }
});

//  invite user list
router.get("/:id/share/list", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await invitePeopleList(req.params.id));
  } catch (err) {
    next(new APIError(err.message));
  }
});

//  invite user edit      
router.put("/:id/share/:type/:userId/edit", authenticate, async (req, res, next: NextFunction) => {
  try {
    const { id, type, userId } = req.params;
    res.status(200).send(await invitePeopleEdit(id, userId, type, req.query.role, res.locals.user));
  } catch (err) {
    next(new APIError(err.message));
  }
});

//  invite user edit
router.delete("/:id/share/:type/:userId/remove", authenticate, async (req, res, next: NextFunction) => {
  try {
    const { id, type, userId } = req.params;
    res.status(200).send(await invitePeopleRemove(id, userId, type, req.query.role, res.locals.user));
  } catch (err) {
    next(new APIError(err.message));
  }
});

//  update exist doc
router.get("/:id/capabilities", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await documnetCapabilities(req.params.id, res.locals.user._id));
  } catch (err) {
    next(new APIError(err.message));
  }
}
);

//  update exist doc
router.post("/:id/publish", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await published(req.body, req.params.id, res.locals.user));
  } catch (err) {
    next(new APIError(err.message));
  }
});

//  update exist doc
router.put("/:id/unpublish", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await unPublished(req.params.id, res.locals.user));
  } catch (err) {
    next(new APIError(err.message));
  }
});

router.put(`/:id/mark-as-public`, authenticate, async (req, res, next) => {
  try {
    res.status(OK).send(await markDocumentAsPublic(req.params.id, res.locals.user.role))
  } catch (error) {
    next(new APIError(error.message))
  }
})

//  update exist doc
router.post("/:id/replace/:replaceDocId", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await replaceDoc(req.params.id, req.params.replaceDocId, res.locals.user));
  } catch (err) {
    next(new APIError(err.message));
  }
}
);


//  update exist doc
router.post("/:id", authenticate, ensureCanEditDocument, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await updateDoc(req.body, req.params.id, res.locals.user._id));
  } catch (err) {
    next(new APIError(err.message));
  }
});

//  update exist doc
router.post("/:id/new", authenticate, ensureCanEditDocument, siteConstants, async (req: any, res, next: NextFunction) => {
  try {
    const fileObj: any = JSON.parse(await uploadToFileService(req) as any)
    res.status(200).send(await updateDocNew(fileObj, req.params.id, res.locals.user._id, req.siteConstants));
  } catch (err) {
    next(new APIError(err.message));
  }
});

//  update exist doc
router.get("/:id/cancle", authenticate, ensureCanEditDocument, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await cancelUpdate(req.params.id, res.locals.user._id));
  } catch (err) {
    next(new APIError(err.message));
  }
});

//  Get Document Details
router.get("/:id", authenticate, ensureCanViewDocument, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await getDocDetails(req.params.id, res.locals.user._id));
  } catch (err) {
    next(new APIError(err.message));
  }
});

//  Create Folder
router.post("/folder/create", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await createFolder(req.body, res.locals.user._id));
  } catch (err) {
    next(new APIError(err.message));
  }
});

//Move file to a folder
router.put("/moveTo/folder/:id", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await moveToFolder(req.params.id, req.body, res.locals.user._id));
  } catch (err) {
    next(new APIError(err.message));
  }
});

//list of folders
router.get("/folder/list", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await listFolders(res.locals.user._id));
  } catch (err) {
    next(new APIError(err.message));
  }
});

//list of folders and files in it
router.get("/folder/:folderId/list", authenticate, async (req, res, next: NextFunction) => {
  try {
    const host = `${req.protocol}://${req.get('host')}`
    res.status(200).send(await getFolderDetails(req.params.folderId, res.locals.user._id, req.query.page, req.query.limit, host));
  } catch (err) {
    next(new APIError(err.message));
  }
});

//delete folder
router.delete("/folder/delete/:id", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await deleteFolder(req.params.id, res.locals.user._id));
  } catch (err) {
    next(new APIError(err.message));
  }
});

router.post("/multiple/list", async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await documentsList(req.body.ids));
  } catch (err) {
    next(new APIError(err.message));
  }
});

router.put("/delete/:id", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await deleteDoc(req.params.id, res.locals.user._id));
  } catch (err) {
    next(new APIError(err.message));
  }
});

router.get("/all/me", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await getListOfFoldersAndFiles(res.locals.user._id, req.query.page, req.query.limit, `${req.protocol}://${req.get('host')}`));
  } catch (err) {
    next(new APIError(err.message));
  }
});

router.post("/:docId/suggest/tags", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await suggestTags(req.params.docId, req.body, res.locals.user._id));
  } catch (err) {
    next(new APIError(err.message));
  }
});
router.post("/:docId/approve/tags", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await approveTags(req.params.docId, req.body, res.locals.user._id));
  } catch (err) {
    next(new APIError(err.message));
  }
});

router.post("/:docId/reject/tags", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await rejectTags(req.params.docId, req.body, res.locals.user._id));
  } catch (err) {
    next(new APIError(err.message));
  }
});

router.post("/get/tags", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await getAllTags(req.body.tags));
  } catch (err) {
    next(new APIError(err.message));
  }
});

router.post("/:docId/delete/suggested/tags", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await deleteSuggestedTag(req.params.docId, req.body, res.locals.user._id));
  } catch (err) {
    next(new APIError(err.message));
  }
});

router.get("/:id/requests/list", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await getAllRequest(req.params.id));
  } catch (err) {
    next(new APIError(err.message));
  }
});

router.post("/:id/requests/accept", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await requestAccept(req.params.id, res.locals.user));
  } catch (err) {
    next(new APIError(err.message));
  }
});

router.post("/:id/requests/denied", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await requestDenied(req.params.id, res.locals.user));
  } catch (err) {
    next(new APIError(err.message));
  }
});

router.post("/:docid/requests/raise", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await requestRaise(req.params.docid, res.locals.user._id));
  } catch (err) {
    next(new APIError(err.message));
  }
});

//  Get All Cmp Docs List
router.get("/allcmp/list", authenticate, async (req, res, next: NextFunction) => {
  try {
    res.status(200).send(await getAllCmpDocs(req.query.page, req.query.limit, `${req.protocol}://${req.get('host')}`, res.locals.user._id));
  } catch (err) {
    next(new APIError(err.message));
  }
});

router.get(`/public`, authenticate, async (req, res, next) => {
  try {
    res.status(OK).send(await getAllPublicDocuments(res.locals.user.role, req.query.page, req.query.limit, `${req.protocol}://${req.get('host')}`))
  } catch (error) {
    next(new APIError(error.message))
  }
})

export = router;