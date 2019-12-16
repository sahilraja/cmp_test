import { documents } from "./model";
import { folders } from "./folder-model";
import * as http from "http";
import { Types, STATES, set } from "mongoose";
import { userRoleAndScope } from "../role/module";
import { tags as Tags } from "../tags/tag_model";
import { themes } from "../project/theme_model";
import {
  groupsAddPolicy,
  groupsRemovePolicy,
  GetUserIdsForDocWithRole,
  GetDocIdsForUser,
  shareDoc,
  getRoleOfDoc,
  GetUserIdsForDoc,
  GetDocCapabilitiesForUser,
  checkCapability,
  userGroupsList,
  groupUserList
} from "../utils/groups";
import { nodemail } from "../utils/email";
import { docInvitePeople, suggestTagNotification, approveTagNotification, rejectTagNotification } from "../utils/email_template";
import { DOCUMENT_ROUTER, MOBILE_TEMPLATES } from "../utils/error_msg";
import { userFindOne, userFindMany, userList, listGroup, searchByname, groupFindOne, getNamePatternMatch, groupPatternMatch } from "../utils/users";
import { checkRoleScope } from '../utils/role_management'
import { configLimit } from '../utils/systemconfig'
import { getTemplateBySubstitutions } from "../email-templates/module";
import { ANGULAR_URL } from "../utils/urls";
import { APIError } from "../utils/custom-error";
import { create } from "../log/module";
import { userCapabilities, getFullNameAndMobile, sendNotification, userDetails, groupList } from "../users/module";
import { docRequestModel } from "./document-request-model";
import { userRolesNotification } from "../notifications/module";
import { mobileSendMessage, getTasksForDocument } from "../utils/utils";

enum STATUS {
  DRAFT = 0,
  DONE = 1,
  PUBLISHED = 2,
  UNPUBLISHED = 3,
  //Added FOR backward compatibility
  APPROVED = -1,
  REJECTED = -2,
  PENDING = -3
}

const es = require('elasticsearch');
const esClient = new es.Client({
  host: 'localhost:9200',
  log: 'trace'
});

esClient.ping({
  // ping usually has a 3000ms timeout
  requestTimeout: Infinity
}, function (error: any) {
  if (error) {
    console.trace('elasticsearch cluster is down!');
  } else {
    console.log('All is well');
  }
});

export async function createIndex(){
    return await esClient.indices.create({index: 'documents'});   
   
}

export async function removeIndex(){
  return await esClient.indices.delete({index: 'documents'});   
 
}
export async function createNewDoc(body: any, userId: any, siteConstant: any, host: string) {
  try {
    let userRoles = await userRoleAndScope(userId);
    let userRole = userRoles.data[0];
    const isEligible = await checkRoleScope(userRole, "create-doc");
    if (!isEligible) {
      throw new APIError(DOCUMENT_ROUTER.NO_PERMISSION, 403);
    }
    if (!Object.keys(body).length || body.upfile == "undefined") throw new Error(DOCUMENT_ROUTER.UNABLE_TO_CREATE)
    const { id: fileId, name: fileName, size: fileSize } = body
    if (!body.docName) throw new Error(DOCUMENT_ROUTER.MANDATORY);
    if (body.docName.length > Number(siteConstant.docNameLength || configLimit.name)) {
      throw new Error(DOCUMENT_ROUTER.DOCUMENT_NAME_LENGTH(siteConstant.docNameLength));
    }
    if (body.description.length > Number(siteConstant.docDescriptionSize || configLimit.description)) {
      throw new Error(DOCUMENT_ROUTER.DOCUMENT_DESCRIPTION_LENGTH(siteConstant.docDescriptionSize))
    }
    let data = await documents.find({ isDeleted: false, parentId: null, ownerId: userId, name: body.docName.toLowerCase() }).exec()
    if (data.length) throw new Error(DOCUMENT_ROUTER.DOCUMENT_NAME_UNIQUE(body.docName));

    body.tags = (Array.isArray(body.tags) ? body.tags : typeof (body.tags) == "string" && body.tags.length ? body.tags.includes("[") ? JSON.parse(body.tags) : body.tags = body.tags.split(',') : []).filter((tag: any) => Types.ObjectId.isValid(tag))

    if (body.tags && body.tags.length) {
      let isEligible = await checkRoleScope(userRole, "add-tag-to-document");
      if (!isEligible) throw new APIError(DOCUMENT_ROUTER.ADD_TAG_PERMISSION, 403);
    }

    let doc: any = await insertDOC(body, userId, { fileId: fileId, fileName: fileName, fileSize: fileSize });
    //  Add user as Owner to this Document
    let role = await groupsAddPolicy(`user/${userId}`, doc.id, "owner");
    if (!role.user) {
      await documents.findByIdAndRemove(doc.id);
      throw new Error(DOCUMENT_ROUTER.CREATE_ROLE_FAIL);
    }
    body.parentId = doc.id;

    let response: any = await insertDOC(body, userId, { fileId: fileId, fileName: fileName, fileSize: fileSize });
    if (body.folderId) {
      await folders.update({ _id: body.folderId }, {
        $push: { doc_id: doc.id }
      })
    }
    await create({ activityType: "DOCUMENT_CREATED", activityBy: userId, tagsAdded: body.tags || [], documentId: doc._id })
    // const insertDoc = async function(indexName, _id, mappingType, data){
    let userDetails: any = await userFindOne("id", userId, { firstName: 1, middleName: 1, lastName: 1, name: 1 })
    let userName;
    if (userDetails.firstName)
      userName = `${userDetails.firstName} ${userDetails.middleName || ""} ${userDetails.lastName || ""}`;
    else {
      userName = userDetails.name
    }
    let fileType = doc.fileName ? (doc.fileName.split(".")).pop() : ""

    let thumbnail = (fileType == "jpg" || fileType == "jpeg" || fileType == "png") ? `${host}/api/docs/get-document/${doc.fileId}` : "N/A"

    let tags = await getTags((body.tags && body.tags.length) ? body.tags.filter((tag: string) => Types.ObjectId.isValid(tag)) : [])
    tags = tags.map((tagData: any) => { return tagData.tag })
    let docObj = {
      accessedBy: [userId],
      userName: [userName],
      name: body.docName,
      description: body.description,
      tags: tags,
      thumbnail: thumbnail,
      status: doc.status,
      fileName: doc.fileName,
      updatedAt: doc.updatedAt,
      id: doc.id
    }
    let result = await esClient.index({
      index: "documents",
      body: docObj,
      id: doc.id
    });
    // }
    return doc;
  } catch (err) {
    throw err
  };
};

//  Create Document
export async function createDoc(body: any, userId: string) {
  try {
    let userRoles = await userRoleAndScope(userId);
    let userRole = userRoles.data[0];
    const isEligible = await checkRoleScope(userRole, "create-doc");
    if (!isEligible) {
      throw new APIError(DOCUMENT_ROUTER.NO_PERMISSION, 403);
    }
    if (!body.name) throw new Error(DOCUMENT_ROUTER.MANDATORY);
    if (body.name.length > configLimit.name) { // added config
      throw new Error("Name " + DOCUMENT_ROUTER.LIMIT_EXCEEDED);
    }
    if (body.description.length > configLimit.description) { // added config
      throw new Error("Description " + DOCUMENT_ROUTER.LIMIT_EXCEEDED);
    }
    let doc = await insertDOC(body, userId);
    body.parentId = doc.id;
    let role = await groupsAddPolicy(`user/${userId}`, doc.id, "owner");
    if (!role.user) {
      await documents.findByIdAndRemove(doc.id);
      throw new Error(DOCUMENT_ROUTER.CREATE_ROLE_FAIL);
    }
    let response: any = await insertDOC(body, userId);
    await create({ activityType: "DOCUMENT_CREATED", activityBy: userId, tagsAdded: body.tags || [], documentId: doc.id })
    return { doc_id: doc.id };
  } catch (error) {
    throw error;
  }
}

//  create Document module
async function insertDOC(body: any, userId: string, fileObj?: any) {
  try {
    return await documents.create({
      name: body.docName || body.name,
      description: body.description || null,
      tags: body.tags,
      versionNum: "1",
      status: fileObj ? STATUS.DONE : STATUS.DRAFT,
      ownerId: userId,
      parentId: body.parentId ? body.parentId : null,
      fileId: fileObj ? fileObj.fileId : null,
      fileName: fileObj ? fileObj.fileName : null,
      fileSize: fileObj ? fileObj.fileSize : null
    });
  } catch (error) {
    console.error(error);
    throw error;
  }
}

//  Get Document Public List
export async function getDocList(page: number = 1, limit: number = 30, host: string, pagination: boolean = true) {
  try {
    let data = await documents.find({ parentId: null, status: STATUS.PUBLISHED }).sort({ updatedAt: -1 });
    const docList = await Promise.all(data.map(async doc => docData(doc, host)));
    if (pagination) {
      data = documentsSort(data, "updatedAt", true)
      return manualPagination(page, limit, docList)
    }
    return docList
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function documentsList(docs: any[]): Promise<object[]> {
  docs = docs.map((id: string) => Types.ObjectId(id))
  return await documents.find({ _id: { $in: docs } })
}

async function docData(docData: any, host: string) {
  try {
    let fileType = docData.fileName ? (docData.fileName.split(".")).pop() : ""
    return {
      ...docData.toJSON(),
      tags: await getTags((docData.tags && docData.tags.length) ? docData.tags.filter((tag: string) => Types.ObjectId.isValid(tag)) : []),
      role: (((await userRoleAndScope(docData.ownerId)) as any).data || [""])[0],
      owner: await userFindOne("id", docData.ownerId, { firstName: 1, middleName: 1, lastName: 1, email: 1 }),
      thumbnail: (fileType == "jpg" || fileType == "jpeg" || fileType == "png") ? `${host}/api/docs/get-document/${docData.fileId}` : "N/A"
    };
  } catch (err) {
    throw err;
  }
}

//  Get My Documents
export async function getDocListOfMe(userId: string, page: number = 1, limit: number = 30, host: string) {
  try {
    let folderList = await folders.find({ ownerId: userId, isDeleted: false }, { _id: 0, doc_id: 1 })
    let folder_files = folderList.map(({ doc_id }: any) => doc_id)
    var merged = [].concat.apply([], folder_files);
    let folderDocIds = JSON.parse(JSON.stringify(merged));
    let docs = await documents.find({ ownerId: userId, parentId: null, isDeleted: false, status: { $ne: STATUS.DRAFT } }).collation({ locale: 'en' }).sort({ name: 1 })
    const docList = await Promise.all(docs.map((doc) => {
      return docData(doc, host);
    }));
    var result = docList.filter((docs) => {
      return !folderDocIds.some((folderDocs: any) => {
        return docs._id == folderDocs;
      });
    })
    result = documentsSort(result, "updatedAt", true)
    return manualPagination(page, limit, result)
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function getDocumentListOfMeWithOutFolders(userId: string, page: number = 1, limit: number = 30, host: string, pagination: boolean = true) {
  try {
    let docs = await documents.find({ ownerId: userId, parentId: null, isDeleted: false, status: { $ne: STATUS.DRAFT } }).collation({ locale: 'en' }).sort({ name: 1 })
    let docList = await Promise.all(docs.map((doc: any) => docData(doc, host)));
    if (pagination) {
      docList = documentsSort(docList, "updatedAt", true)
      return manualPagination(page, limit, docList);
    }
    return docList
  } catch (err) {
    throw err
  };
};

//  Create File
export async function createFile(docId: string, file: any) {
  try {
    if (!Types.ObjectId.isValid(docId))
      throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID);
    const { id, name } = JSON.parse(file);
    if (!id || !name) throw new Error(DOCUMENT_ROUTER.MANDATORY);
    let [child, parent]: any = await Promise.all([
      documents.find({ parentId: docId, isDeleted: false }).sort({ createdAt: -1 }).exec(),
      documents.findByIdAndUpdate(docId, { fileId: id, fileName: name }, { new: true }).exec()
    ]);
    if (!child.length) throw new Error(DOCUMENT_ROUTER.CHILD_NOT_FOUND);
    await documents.findByIdAndUpdate(child[0].id, { fileId: id, fileName: name }, { new: true });
    return { doc_id: docId };
  } catch (error) {
    console.error(error);
    throw error;
  }
}

//  Submit for approval
export async function submit(docId: string) {
  try {
    if (!Types.ObjectId.isValid(docId))
      throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID);
    let [parent, child]: any = await Promise.all([
      documents.findById(docId).exec(),
      documents
        .find({ parentId: docId, isDeleted: false })
        .sort({ createdAt: -1 })
        .exec()
    ]);
    if (!child.length) throw new Error(DOCUMENT_ROUTER.CHILD_NOT_FOUND);
    child = await documents.findById(child[0].id);
    if (!child.fileId || !parent.fileId)
      throw new Error(DOCUMENT_ROUTER.FILE_NOT_FOUND);
    let [childDoc, parentDoc]: any = await Promise.all([
      documents
        .findByIdAndUpdate(child.id, { status: STATUS.DONE }, { new: true })
        .exec(),
      documents
        .findByIdAndUpdate(docId, { status: STATUS.DONE }, { new: true })
        .exec()
    ]);
    return { docId: docId, fileId: parentDoc.fileId };
  } catch (error) {
    console.error(error);
    throw error;
  }
}

//  Create New Version
export async function createNewVersion(
  docId: string,
  versionID: string,
  userId: any,
  obj: any
) {
  try {
    if (!versionID) throw new Error("DocId Is Missing.");
    let [docDetails, DocList]: any = await Promise.all([
      documents
        .findOne({
          _id: Types.ObjectId(versionID),
          $or: [{ status: STATUS.APPROVED }, { status: STATUS.REJECTED }]
        })
        .exec(),
      documents
        .find({ parentId: docId })
        .sort({ createdAt: -1 })
        .exec()
    ]);
    if (!docDetails) throw new Error("Document Not Exist.");
    let createNewDoc: any = await documents.create({
      name: obj.name,
      description: obj.description,
      themes: obj.themes,
      tags: obj.tags,
      versionNum: Number(DocList[0].versionNum) + 1,
      status: STATUS.DRAFT,
      ownerId: userId,
      parentId: docDetails.parentId,
      fileName: docDetails.fileName,
      fileId: docDetails.fileId
    });
    return { doc_id: createNewDoc.parentid, versionID: createNewDoc.id };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

//  Reject Document
export async function RejectDoc(docId: string, versionId: string) {
  try {
    if (!docId || !versionId) throw new Error("Missing fields");
    let [child, parentDoc]: any = await Promise.all([
      documents
        .findByIdAndUpdate(
          versionId,
          { status: STATUS.REJECTED },
          { new: true }
        )
        .exec(),
      documents.findById(docId).exec()
    ]);
    if (parentDoc.status != STATUS.APPROVED) {
      await documents.findByIdAndUpdate(parentDoc.id, {
        status: STATUS.REJECTED
      });
    }
    return { message: "Document Rejected." };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

// Approve Document
export async function ApproveDoc(docId: string, versionId: string) {
  try {
    if (!versionId || !docId) throw new Error("Missing DocID.");
    let [child, parent] = await Promise.all([
      documents
        .findByIdAndUpdate(
          versionId,
          { status: STATUS.APPROVED },
          { new: true }
        )
        .exec(),
      documents
        .findByIdAndUpdate(docId, { status: STATUS.APPROVED }, { new: true })
        .exec()
    ]);
    return { message: "Document Approved." };
  } catch (err) {
    console.error(err);
    throw err;
  }
}

//  Get Doc Details
export async function getDocDetails(docId: any, userId: string, token: string) {
  try {
    if (!Types.ObjectId.isValid(docId)) throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID);
    let publishDocs: any = await documents.findById(docId);
    if (publishDocs.isDeleted) throw new Error(DOCUMENT_ROUTER.DOCUMENT_DELETED)
    if (publishDocs.status != 2 && publishDocs.parentId == null) {
      let userCapability = await documnetCapabilities(publishDocs.parentId || publishDocs._id, userId)
      if (!userCapability.length) throw new Error(DOCUMENT_ROUTER.USER_HAVE_NO_ACCESS)
    }
    let filteredDocs: any;
    let filteredDocsToRemove: any;
    const docList = publishDocs.toJSON();
    if (docList.parentId) {
      let parentDoc: any = await documents.findById(docList.parentId)
      docList.tags = parentDoc.tags
      docList.suggestedTags = parentDoc.suggestedTags,
        docList.suggestTagsToAdd = parentDoc.suggestTagsToAdd,
        docList.suggestTagsToRemove = parentDoc.suggestTagsToRemove
    }
    if (docList.ownerId == userId) {
      filteredDocs = docList.suggestTagsToAdd
      filteredDocsToRemove = docList.suggestTagsToRemove
    } else {
      filteredDocs = docList.suggestTagsToAdd.filter((tag: any) => tag.userId == userId)
      filteredDocsToRemove = docList.suggestTagsToRemove.filter((tag: any) => tag.userId == userId)
    }

    const userData = Array.from(
      new Set(filteredDocs.map((_respdata: any) => _respdata.userId))
    ).map((userId: any) => ({
      userId,
      tags: filteredDocs
        .filter((_respdata: any) => _respdata.userId == userId)
        .reduce((resp: any, eachTag: any) => [...resp, ...eachTag.tags], [])
    }));
    let users = await Promise.all(userData.map((suggestedTagsInfo: any) => userInfo(suggestedTagsInfo)))
    docList.suggestTagsToAdd = users

    const userDataForRemoveTag = Array.from(
      new Set(filteredDocsToRemove.map((_respdata: any) => _respdata.userId))
    ).map((userId: any) => ({
      userId,
      tags: filteredDocsToRemove
        .filter((_respdata: any) => _respdata.userId == userId)
        .reduce((resp: any, eachTag: any) => [...resp, ...eachTag.tags], [])
    }));
    let usersDataForRemoveTag = await Promise.all(userDataForRemoveTag.map((suggestedTagsInfo: any) => userInfo(suggestedTagsInfo)))
    docList.suggestTagsToRemove = usersDataForRemoveTag
    docList.tags = await getTags((docList.tags && docList.tags.length) ? docList.tags.filter((tag: string) => Types.ObjectId.isValid(tag)) : []),
      docList.role = (((await userRoleAndScope(docList.ownerId)) as any).data || [""])[0],
      docList.owner = await userFindOne("id", docList.ownerId, { firstName: 1, lastName: 1, middleName: 1, email: 1 });
    docList.taskDetails = await getTasksForDocument(docList.parentId || docList._id, token)
    await create({ activityType: `DOCUMENT_VIEWED`, activityBy: userId, documentId: docId })
    return docList;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export async function getDocumentById(docId: string): Promise<any> {
  if (!Types.ObjectId.isValid(docId))
    throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID);
  let details: any = await documents.findById(docId);
  if (!details) throw new Error(DOCUMENT_ROUTER.DOCUMENT_NOT_FOUND)
  return details;
}

export async function getDocumentVersionById(versionId: string): Promise<any> {
  if (!versionId) {
    throw new Error("No document id given.");
  }
  const doc = await documents.findById(versionId);
  if (!doc) {
    throw new Error("No document found with given id");
  }
  return doc;
}

//  Get doc with Version
export async function getDocWithVersion(docId: any, versionId: any) {
  try {
    if (!docId || !versionId) throw new Error("Missing Fields");
    let docDetails: any = await documents.findById(versionId);
    const docList = docDetails.toJSON();
    docList.tags = await getTags(docList.tags);
    docList.themes = await getThemes(docList.themes);
    let role: any = await userRoleAndScope(docList.ownerId);
    docList.role = role.data[0];
    return docList;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export async function updateDoc(objBody: any, docId: any, userId: string) {
  try {
    if (!Types.ObjectId.isValid(docId))
      throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID);
    let capability = await GetDocCapabilitiesForUser(userId, docId);
    if (capability.includes("viewer"))
      throw new Error(DOCUMENT_ROUTER.INVALID_ADMIN);
    let obj: any = {};
    if (objBody.name) {
      if (objBody.name.length > configLimit.name) {
        throw new Error(DOCUMENT_ROUTER.DOCUMENT_NAME_LENGTH(configLimit.name));
      }
      obj.name = objBody.name;
    }
    if (objBody.description) {
      if (objBody.description.length > configLimit.description) {
        throw new Error(DOCUMENT_ROUTER.DOCUMENT_DESCRIPTION_LENGTH(configLimit.description));
      }
      obj.description = objBody.description;
    }
    if (objBody.tags) {
      obj.tags = objBody.tags;
    }
    let child: any = await documents.find({ parentId: docId, isDeleted: false }).sort({ createdAt: -1 }).exec()
    if (!child.length) throw new Error(DOCUMENT_ROUTER.CHILD_NOT_FOUND);
    obj.versionNum = Number(child[0].versionNum) + 1
    let parent: any = await documents.findByIdAndUpdate(docId, obj, { new: true }).exec()
    await documents.create({
      name: parent.name,
      description: parent.description,
      tags: parent.tags,
      versionNum: Number(child[0].versionNum) + 1,
      status: parent.status,
      ownerId: userId,
      parentId: parent.id,
      fileId: parent.fileId,
      fileName: parent.fileName
    })
    let isDocExists = await checkDocIdExistsInEs(docId)
    if(isDocExists){
      let tags: any = await getTags(parent.tags.filter((tag: string) => Types.ObjectId.isValid(tag)))
      let tagNames = tags.map((tag: any) => { return tag.tag })
      let updatedData = await esClient.update({
        index: "documents",
        id: docId,
        body: {
          "script": {
            "source": "ctx._source.tags=(params.tags);ctx._source.name=(params.name);ctx._source.description=(params.description);ctx._source.fileName=(params.fileName);",
            "lang": "painless",
            "params": {
              "tags": tagNames,
              "name":parent.name,
              "description": parent.description,
              "fileName": parent.fileName
            }
          }
        }
      })
    }
    return parent;
  } catch (err) {
    console.error(err);
    throw err;
  };
};

export async function cancelUpdate(docId: string, userId: string) {
  try {
    await create({ activityType: `CANCEL_UPDATED`, activityBy: userId, documentId: docId })
    return { success: true }
  } catch (err) {
    throw err;
  };
};

export async function updateDocNew(objBody: any, docId: any, userId: string, siteConstants: any) {
  try {
    if (!Types.ObjectId.isValid(docId)) throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID);
    let capability = await GetDocCapabilitiesForUser(userId, docId);
    if (capability.includes("viewer")) throw new Error(DOCUMENT_ROUTER.INVALID_ADMIN);
    let obj: any = {};
    if (objBody.docName) {
      if (objBody.docName.length > Number(siteConstants.docNameLength || configLimit.name)) throw new Error(`Document name should not exceed more than ${siteConstants.docNameLength} characters`);
      let data = await documents.findOne({ _id: { $ne: docId }, isDeleted: false, parentId: null, ownerId: userId, name: objBody.docName.toLowerCase() }).exec()
      if (data) {
        throw new Error(DOCUMENT_ROUTER.DOC_ALREADY_EXIST);
      }
      obj.name = objBody.docName.toLowerCase();
    }
    if (objBody.description || objBody.description == "") {
      if (objBody.description.length > Number(siteConstants.docDescriptionSize || configLimit.description)) throw new Error(`Document description should not exceed more than ${siteConstants.docDescriptionSize} characters`)
      obj.description = objBody.description;
    }

    objBody.tags = (Array.isArray(objBody.tags) ? objBody.tags : typeof (objBody.tags) == "string" && objBody.tags.length ? objBody.tags.includes("[") ? JSON.parse(objBody.tags) : objBody.tags = objBody.tags.split(',') : []).filter((tag: any) => Types.ObjectId.isValid(tag))

    if (objBody.tags && !objBody.docName && !objBody.description) {
      let document: any = await documents.findById(docId)
      let userRoles = await userRoleAndScope(userId);
      let userRole = userRoles.data[0];
      const isEligible = document.status == 2 ? await checkRoleScope(userRole, "add-tags-publish") : await checkRoleScope(userRole, "add-tag-to-document")
      if (!isEligible) {
        throw new APIError(DOCUMENT_ROUTER.NO_TAGS_PERMISSION, 403);
      }
      if (!capability.includes("owner")) throw new Error("Invalid Action")
      obj.tags = typeof (objBody.tags) == "string" ? JSON.parse(objBody.tags) : objBody.tags;
    }

    if (objBody.name && objBody.id) {
      obj.fileId = objBody.id
      obj.fileName = objBody.name
    }
    let child: any = await documents.find({ parentId: docId, isDeleted: false }).sort({ createdAt: -1 }).exec()
    if (!child.length) throw new Error(DOCUMENT_ROUTER.CHILD_NOT_FOUND);
    if (objBody.description || objBody.docName || objBody.id) obj.versionNum = Number(child[0].versionNum) + 1
    let parent: any = await documents.findByIdAndUpdate(docId, obj, { new: true }).exec()
    if (objBody.description || objBody.docName || objBody.id) {
      await documents.create({
        name: parent.name,
        description: parent.description,
        tags: parent.tags,
        versionNum: Number(child[0].versionNum) + 1,
        status: parent.status,
        ownerId: userId,
        parentId: parent.id,
        fileId: objBody.id || parent.fileId,
        fileName: objBody.name || parent.fileName,
        suggestedTags: parent.suggestedTags
      });
      const message = `${child[0].name != parent.name ? "name" : ""}${child[0].description != parent.description ? child[0].name != parent.name ? child[0].fileId != parent.fileId ? ", description" : " and description" : "description" : ""}${child[0].fileId != parent.fileId ? child[0].description != parent.description ? " and file" : child[0].name != parent.name ? " and file" : "file" : ""}`
      mailAllCmpUsers("documentUpdate", parent, false, message)
      await create({ activityType: `DOCUMENT_UPDATED`, activityBy: userId, documentId: docId })
    } else {
      await documents.findByIdAndUpdate(child[child.length - 1]._id, { tags: parent.tags, suggestedTags: parent.suggestedTags })
      let addtags = obj.tags.filter((tag: string) => !child[child.length - 1].tags.includes(tag))
      if (addtags.length) {
        let tags = ((await Tags.find({ "_id": { $in: addtags } })).map(({ tag }: any) => tag)).join(",")
        const message = tags.lastIndexOf(",") == -1 ? `${tags} tag added` : `${tags.slice(0, tags.lastIndexOf(",")) + " and " + tags.slice(tags.lastIndexOf(",") + 1)} tags`
        mailAllCmpUsers("documentUpdate", parent, false, message)
        await create({ activityType: `TAGS_ADDED`, activityBy: userId, documentId: docId, tagsAdded: addtags })
      }
      let removedtags = child[child.length - 1].tags.filter((tag: string) => !obj.tags.includes(tag))
      if (removedtags.length) {
        let tags = ((await Tags.find({ "_id": { $in: removedtags } })).map(({ tag }: any) => tag)).join(",")
        const message = tags.lastIndexOf(",") == -1 ? `${tags} tag removed` : `${tags.slice(0, tags.lastIndexOf(",")) + " and " + tags.slice(tags.lastIndexOf(",") + 1)} tags`
        mailAllCmpUsers("documentUpdate", parent, false, message)
        await create({ activityType: `TAGS_REMOVED`, activityBy: userId, documentId: docId, tagsRemoved: removedtags })
      }
    }
    let isDocExists = await checkDocIdExistsInEs(docId)
    if(isDocExists){
      let tags: any = await getTags(parent.tags.filter((tag: string) => Types.ObjectId.isValid(tag)))
      let tagNames = tags.map((tag: any) => { return tag.tag })
      let updatedData = await esClient.update({
        index: "documents",
        id: docId,
        body: {
          "script": {
            "source": "ctx._source.tags=(params.tags);ctx._source.name=(params.name);ctx._source.description=(params.description);ctx._source.fileName=(params.fileName);",
            "lang": "painless",
            "params": {
              "tags": tagNames,
              "name":parent.name,
              "description": parent.description,
              "fileName": parent.fileName
            }
          }
        }
      })
    }
    return parent;
  } catch (err) {
    console.error(err);
    throw err;
  }
}
export async function approvalList(host: string) {
  try {
    let docList = await documents.find({ parentId: { $ne: null }, status: STATUS.PUBLISHED, isDeleted: false }).collation({ locale: 'en' }).sort({ name: 1 });
    let parentDocsIdsArray = docList.map((doc: any) => {
      return doc.parentId;
    });
    let parentDocList = await documents.find({
      _id: { $in: parentDocsIdsArray }, isDeleted: false
    });
    return await Promise.all(
      parentDocList.map(async doc => {
        return await docData(doc, host);
      })
    );
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export async function uploadToFileService(request: any, size?: number) {
  const options: any = {
    hostname: process.env.FILE_SERVICE_HOST,
    port: process.env.FILE_SERVICE_PORT,
    path: `/files?size=${size}`,
    method: "POST",
    headers: request.headers
  };
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      // response.writeHead(200, res.headers);
      res.setEncoding("utf8");
      let content = "";
      res.on("data", chunk => {
        content += chunk;
      });
      res.on("end", () => {
        resolve(content);
      });
    });
    req.on("error", e => {
      console.error(e);
      reject(e)
    });
    request.pipe(req);
  });
}

export async function getVersions(docId: string) {
  try {
    if (!docId) throw new Error(DOCUMENT_ROUTER.DOCUMENT_ID_NOT_FOUND);
    let docVersions: any = await documents.find({ parentId: docId, status: { $ne: STATUS.DRAFT }, isDeleted: false }, { versionNum: 1, status: 1, createdAt: 1, updatedAt: 1 }).sort({ createdAt: -1 });
    if (!docVersions.length) throw new Error(DOCUMENT_ROUTER.DOCUMENTS_NOT_THERE);
    return docVersions;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function getApprovalDoc(docId: string) {
  try {
    if (!docId) throw new Error(DOCUMENT_ROUTER.DOCUMENT_ID_NOT_FOUND);
    let [parent, pendingDoc]: any = await Promise.all([
      documents.findById(docId).exec(),
      documents
        .find({ parentId: docId, status: STATUS.PENDING, isDeleted: false })
        .sort({ createdAt: -1 })
        .exec()
    ]);
    const parentDoc = parent.toJSON();
    parentDoc.tags = await getTags(parentDoc.tags);
    parentDoc.themes = await getThemes(parentDoc.themes);
    let parentRole: any = await userRoleAndScope(parentDoc.ownerId);
    parentDoc.role = parentRole.data[0];
    const modifiedDoc = pendingDoc[0].toJSON();
    modifiedDoc.tags = await getTags(modifiedDoc.tags);
    modifiedDoc.themes = await getThemes(modifiedDoc.themes);
    let modifiedRole: any = await userRoleAndScope(parentDoc.ownerId);
    parentDoc.role = modifiedRole.data[0];
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export async function getTags(tagIds: any[]) {
  try {
    return await Tags.find({ _id: { $in: tagIds }, deleted: false }, { tag: 1 });
  } catch (err) {
    console.error(err);
    throw err;
  }
}

export async function getAllTags(tags: any) {
  try {
    let tagIds = (tags && tags.length) ? tags.filter((tag: string) => Types.ObjectId.isValid(tag)) : []
    return await Tags.find({ _id: { $in: tagIds }, deleted: false }, { tag: 1 });
  } catch (err) {
    console.error(err);
    throw err;
  }
}

async function getThemes(themeIds: any[]) {
  try {
    return await themes.find({ _id: { $in: themeIds } }, { theme: 1 });
  } catch (err) {
    console.error(err);
    throw err;
  }
}

//  Add Collaborator
export async function addCollaborator(docId: string, collaborators: string[]) {
  try {
    if (!Types.ObjectId.isValid(docId)) throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID);
    if (!Array.isArray(collaborators))
      throw new Error("Missing Collaborators.");
    await Promise.all([
      collaborators.map(async (user: string) => {
        let success = await groupsAddPolicy(user, docId, "collaborator");
        if (!success.user)
          throw new Error(`${user} have already these permissions`);
      })
    ]);
    return { message: "added collaborators successfully." };
  } catch (err) {
    throw err;
  }
}

//  remove Collaborator
export async function removeCollaborator(
  docId: string,
  collaborators: string[]
) {
  try {
    if (!Types.ObjectId.isValid(docId)) throw new Error("Given id not Valid");
    if (!Array.isArray(collaborators))
      throw new Error("Missing Collaborators.");
    await Promise.all([
      collaborators.map(async (user: string) => {
        let success = await groupsRemovePolicy(user, docId, "collaborator");
        if (!success.user)
          throw new Error(`${user} don't have these permissions`);
      })
    ]);
    return { message: "Remove collaborators successfully." };
  } catch (err) {
    throw err;
  }
}

//  Add Viewers
export async function addViewers(docId: string, viewers: string[]) {
  try {
    if (!Types.ObjectId.isValid(docId)) throw new Error("Given id not Valid");
    if (!Array.isArray(viewers)) throw new Error("Missing viewers.");
    await Promise.all([
      viewers.map(async (user: string) => {
        let success = await groupsAddPolicy(user, docId, "viewer");
        if (!success.user)
          throw new Error(`${user} have already these permissions`);
      })
    ]);
    return { message: "added viewers successfully." };
  } catch (err) {
    throw err;
  }
}

//  remove Viewers
export async function removeViewers(docId: string, viewers: string[]) {
  try {
    if (!Types.ObjectId.isValid(docId)) throw new Error("Given id not Valid");
    if (!Array.isArray(viewers)) throw new Error("Missing viewers.");
    await Promise.all([
      viewers.map(async (user: string) => {
        let success = await groupsRemovePolicy(user, docId, "viewer");
        if (!success.user)
          throw new Error(`${user} don't have these permissions`);
      })
    ]);
    return { message: "remove viewers successfully." };
  } catch (err) {
    throw err;
  }
}

export async function collaboratorList(docId: string) {
  try {
    let users = await GetUserIdsForDocWithRole(docId, "collaborator");
    return await userList({ _id: { $in: users } }, { firstName: 1, middleName: 1, lastName: 1, email: 1 });
  } catch (err) {
    throw err;
  }
}

export async function viewerList(docId: string) {
  try {
    let users = await GetUserIdsForDocWithRole(docId, "viewer");
    return await userList({ _id: { $in: users } }, { firstName: 1, middleName: 1, lastName: 1, email: 1 });
  } catch (err) {
    throw err;
  }
}

export async function sharedList(userId: string, page: number = 1, limit: number = 30, host: string, pagination: boolean = true) {
  try {
    let docIds: any = []
    let groups = await userGroupsList(userId)
    docIds = await Promise.all(groups.map((groupId: string) => GetDocIdsForUser(groupId, "group")));
    docIds = docIds.reduce((main: [], arr: []) => main.concat(arr), [])
    docIds = [... new Set(docIds.concat(await GetDocIdsForUser(userId)))].filter((id: any) => Types.ObjectId.isValid(id));
    let docs = await documents.find({ _id: { $in: docIds }, isDeleted: false }).collation({ locale: 'en' }).sort({ name: 1 });
    let data = await Promise.all(
      docs.map(async (doc: any) => {
        const filteredDocs = doc.suggestTagsToAdd ? doc.suggestTagsToAdd.filter((tag: any) => tag.userId == userId) : []
        const filteredDocsForRemove = doc.suggestTagsToRemove ? doc.suggestTagsToRemove.filter((tag: any) => tag.userId == userId) : []
        doc.suggestTagsToAdd = filteredDocs
        doc.suggestedTagsToRemove = filteredDocsForRemove
        return await docData(doc, host);
      })
    );
    data = data.filter(({ ownerId }: any) => ownerId != userId)
    if (pagination) {
      data = documentsSort(data, "updatedAt", true)
      return manualPagination(page, limit, data)
    };
    return data
  } catch (err) {
    throw err;
  }
}

export async function allDocuments(userId: string, page: number = 1, limit: number = 30, host: string, pagination: boolean = true) {
  try {
    let data = [
      ...(await getDocList(page, limit, host, false) as any),
      ...(await sharedList(userId, page, limit, host, false) as any),
      ...(await getDocumentListOfMeWithOutFolders(userId, page, limit, host, false) as any),
    ]
    if (pagination) {
      data = documentsSort(data, "name", false)
      return manualPagination(page, limit, data)
    }
    return data
  } catch (err) {
    throw err
  }
}

export async function documnetCapabilities(docId: string, userId: string): Promise<any[]> {
  try {
    let groups = await userGroupsList(userId)
    let viewer
    let doc: any = await documents.findById(docId);
    if (doc.status == 2) return ["public"]
    let acceptCapabilities = ["owner", "collaborator", "viewer"]
    let capability = await GetDocCapabilitiesForUser(userId, docId)
    if (capability.length) {
      let role: any = capability.filter((capability: any) => acceptCapabilities.includes(capability)).pop()
      if (role == "owner" || role == "collaborator") return [role]
      if (role == "viewer") viewer = role
    }
    if (groups.length) {
      for (const groupId of groups) {
        let capability = await GetDocCapabilitiesForUser(groupId, docId, "group")
        if (capability.length) {
          let role: any = capability.filter((capability: any) => acceptCapabilities.includes(capability)).pop()
          if (role == "collaborator") return [role]
          if (role == "viewer") viewer = role
        }
      };
    }
    let request = await docRequestModel.findOne({ docId, requestedBy: userId, isDelete: false })
    if (viewer) {
      return request ? ["viewer", true] : ["viewer"]
    }
    return request ? ["no_access", true] : ["no_access"]
  } catch (err) {
    throw err;
  };
};

function documentsSort(data: any[], key: string, date: boolean = false) {
  try {
    if (date) {
      return data.sort((a: any, b: any) => (new Date(b[key]) as any) - (new Date(a[key]) as any));
    }
    return data.sort((a: any, b: any) => (a[key] as string).localeCompare(b[key]));
  } catch (err) {
    throw err
  };
};

async function invite(user: any, docId: any, role: any, doc: any) {
  await shareDoc(user._id, user.type, docId, role);
  if (user.type == "user") {
    inviteMail(user._id, doc)
  } else if (user.type == "group") {
    let userIds = await groupUserList(user._id)
    userIds = userIds.filter(userId => userIds != doc.ownerId)
    await Promise.all(userIds.map(userId => inviteMail(userId, doc)))
  }
};

async function inviteMail(userId: string, doc: any) {
  try {
    let userData: any = await userFindOne("id", userId);
    let userName = `${userData.firstName} ${userData.middleName || ""} ${userData.lastName || ""}`;
    const { fullName, mobileNo } = getFullNameAndMobile(userData);
    sendNotification({ id: userData._id, fullName, mobileNo, email: userData.email, documentName: doc.name, documentUrl: `${ANGULAR_URL}/home/resources/doc/${doc._id}`, templateName: "inviteForDocument", mobileTemplateName: "inviteForDocument" });
  } catch (err) {
    throw err;
  };
};

export async function invitePeople(docId: string, users: any, role: string, userId: string) {
  try {
    if (!docId || !Array.isArray(users) || !users.length || !role) throw new Error(DOCUMENT_ROUTER.INVALID_OR_MISSING_DATA);
    let doc: any = await documents.findById(docId);
    if (doc.status == 2) throw new Error(DOCUMENT_ROUTER.SHARE_PUBLISHED_DOCUMENT)
    let userRole = await documnetCapabilities(docId, userId)
    if (userRole.includes("collaborator") && role != "viewer") throw new Error(DOCUMENT_ROUTER.INVALID_COLLABORATOR_ACTION)
    if (userRole.includes("viewer") || userRole.includes("no_access")) throw new Error(DOCUMENT_ROUTER.INVALID_VIEWER_ACTION)
    let addUsers: any = []
    let userIds: any = []
    let userNames: any = []
    await Promise.all(
      users.map(async (user: any) => {
        if (doc.ownerId != user._id) {
          addUsers.push({ id: user._id, type: user.type, role: role })
          userIds.push(user._id);
          let userDetails: any = await userFindOne("id", user._id, { firstName: 1, middleName: 1, lastName: 1, email: 1 })
          if (role == "collaborator")
            userNames.push(`${userDetails.firstName} ${userDetails.middleName || ""} ${userDetails.lastName || ""}`)
          return await invite(user, docId, role, doc)
        }
      })
    );
    let isDocExists = await checkDocIdExistsInEs(docId)
    if(isDocExists){
    let updatedData = await esClient.update({
      index: "documents",
      id: docId,
      body: {
        "script": {
          "source": "ctx._source.accessedBy.addAll(params.userId);ctx._source.userName.addAll(params.userNames)",
          "lang": "painless",
          "params": {
            "userId": userIds,
            "userNames": userNames
          }
        }
      }
    })
  }
    await create({ activityType: `DOCUMENT_SHARED_AS_${role}`.toUpperCase(), activityBy: userId, documentId: docId, documentAddedUsers: addUsers })
    mailAllCmpUsers("invitePeopleDoc", doc, false, addUsers)
    return { message: "Shared successfully." };
  } catch (err) {
    throw err;
  }
}

export async function invitePeopleEdit(docId: string, userId: string, type: string, role: string, userObj: any) {
  try {
    if (!docId || !userId || !type || !role) throw new Error(DOCUMENT_ROUTER.MANDATORY);
    let actionUserRole = await documnetCapabilities(docId, userObj._id)
    if (actionUserRole.includes("collaborator") && role != "viewer") throw new Error(DOCUMENT_ROUTER.INVALID_COLLABORATOR_ACTION)
    if (actionUserRole.includes("viewer") || actionUserRole.includes("no_access")) throw new Error(DOCUMENT_ROUTER.INVALID_VIEWER_ACTION)
    let userRole: any = await getRoleOfDoc(userId, docId, type);
    await groupsRemovePolicy(`${type}/${userId}`, docId, userRole[2]);
    await groupsAddPolicy(`${type}/${userId}`, docId, role);
    await create({ activityType: `MODIFIED_${type}_SHARED_AS_${role}`.toUpperCase(), activityBy: userObj._id, documentId: docId, documentAddedUsers: [{ id: userId, type: type, role: role }] })
    mailAllCmpUsers("invitePeopleEditDoc", await documents.findById(docId), false, [{ id: userId, type: type, role: role }])
    return { message: "Edit user successfully." };
  } catch (err) {
    throw err;
  }
}

export async function invitePeopleRemove(docId: string, userId: string, type: string, role: string, userObj: any) {
  try {
    if (!docId || !userId || !type || !role) throw new Error(DOCUMENT_ROUTER.MANDATORY);
    let userRole = await documnetCapabilities(docId, userObj._id)
    if (!userRole.includes("owner")) throw new Error(DOCUMENT_ROUTER.INVALID_ACTION_TO_REMOVE_SHARE_CAPABILITY)
    await groupsRemovePolicy(`${type}/${userId}`, docId, role);
    await create({ activityType: `REMOVED_${type}_FROM_DOCUMENT`.toUpperCase(), activityBy: userObj._id, documentId: docId, documentRemovedUsers: [{ id: userId, type: type, role: role }] })
    mailAllCmpUsers("invitePeopleRemoveDoc", await documents.findById(docId), false, [{ id: userId, type: type, role: role }])

    let userDetails: any = await userFindOne("id", userId, { firstName: 1, middleName: 1, lastName: 1, email: 1 })
    let userName = (`${userDetails.firstName} ${userDetails.middleName || ""} ${userDetails.lastName || ""}`)
    let isDocExists = await checkDocIdExistsInEs(docId)
    if(isDocExists){
    let updatedData = await esClient.update({
      index: "documents",
      id: docId,
      body: {
        "script": {
          "inline": "ctx._source.accessedBy.remove(ctx._source.accessedBy.indexOf(params.accessedBy));ctx._source.userName.remove(ctx._source.userName.indexOf(params.userName))",
          // "source": "ctx._source.accessedBy.remove(params.accessedBy)",
          "lang": "painless",
          "params": {
            "accessedBy": userId,
            "userName": userName
          }
        }
      }
    })
  }
    return { message: `Removed ${type.toLowerCase()} successfully.` };
  } catch (err) {
    throw err;
  }
}

export async function invitePeopleList(docId: string) {
  try {
    if (!Types.ObjectId.isValid(docId)) throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID);
    let users = await GetUserIdsForDoc(docId);
    if (!users.length) {
      return [];
    }
    let total: any = [];
    let userGroup: any = {};
    users.map((user: any) => {
      if (userGroup[user.split("/")[0]]) {
        userGroup[user.split("/")[0]].push(user.split("/")[1]);
      } else {
        userGroup[user.split("/")[0]] = [user.split("/")[1]];
      }
    });
    if (userGroup.user) {
      var userData: any = await userList(
        { _id: { $in: userGroup.user }, is_active: true },
        { firstName: 1, middleName: 1, lastName: 1, email: 1 }
      );
      userData = await Promise.all(
        userData.map(async (user: any) => {
          return {
            id: user._id,
            firstName: user.firstName,
            middleName: user.middleName,
            lastName: user.lastName,
            type: "user",
            email: user.email,
            role: (((await userRoleAndScope(user._id)) as any).data || [""])[0],
            docRole: (((await getRoleOfDoc(user._id, docId)) as any) || Array(2))[2]
          };
        })
      );
      total = [...userData];
    }
    if (userGroup.group) {
      var groupData: any = await listGroup(
        { _id: { $in: userGroup.group }, is_active: true },
        { name: 1 }
      );
      groupData = await Promise.all(
        groupData.map(async (group: any) => {
          return {
            id: group._id,
            name: group.name,
            type: "group",
            email: "N/A",
            docRole: (((await getRoleOfDoc(group._id, docId, "group")) as any) || Array(2))[2],
            role: "N/A"
          };
        })
      );
      total = !total.length ? [...groupData] : total.concat(groupData);
    }
    return total;
  } catch (err) {
    throw err;
  }
}

export async function docCapabilities(docId: string, userId: string) {
  try {
    return await GetDocCapabilitiesForUser(userId, docId);
  } catch (err) {
    throw err;
  }
}

export async function published(body: any, docId: string, userObj: any, withAuth: boolean = true) {
  try {
    if (!Types.ObjectId.isValid(docId)) throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID)
    if (withAuth) {
      let admin_scope = await checkRoleScope(userObj.role, "publish-document");
      if (!admin_scope) throw new APIError(DOCUMENT_ROUTER.PUBLISH_CAPABILITY, 403);
    };
    if (body.tags && body.tags.length) {
      let isEligible = await checkRoleScope(userObj.role, "add-tag-to-document");
      if (!isEligible) {
        throw new APIError(DOCUMENT_ROUTER.NO_TAGS_PERMISSION, 403);
      }
    }
    let doc: any = await documents.findById(docId);
    if (!doc) throw new Error("Doc Not Found")
    let publishedDoc = await publishedDocCreate({ ...body, status: STATUS.PUBLISHED }, userObj._id, doc, docId)
    await create({ activityType: `DOUCMENT_PUBLISHED`, activityBy: userObj._id, documentId: publishedDoc._id, fromPublished: docId })
    let role = await groupsAddPolicy(`user/${userObj._id}`, publishedDoc._id, "owner");
    if (!role.user) {
      await documents.findByIdAndRemove(publishedDoc._id);
      throw new Error(DOCUMENT_ROUTER.CREATE_ROLE_FAIL);
    }
    let publishedChild = await publishedDocCreate({ ...body, parentId: publishedDoc._id, status: STATUS.DONE }, userObj._id, doc)
    mailAllCmpUsers("publishDocument", publishedDoc)
    let isDocExists = await checkDocIdExistsInEs(docId)
    if(isDocExists){
    let updatedData = await esClient.update({
      index: "documents",
      id: docId,
      body: {
        "script": {
          "source": "ctx._source.status=(params.status)",
          "lang": "painless",
          "params": {
            "status": STATUS.PUBLISHED,
          }
        }
      }
    })
  }
    return publishedDoc
  } catch (err) {
    throw err;
  };
};

async function publishedDocCreate(body: any, userId: string, doc: any, docId?: string) {
  try {
    return await documents.create({
      sourceId: docId || null,
      name: body.name || doc.name,
      description: body.description || doc.name,
      themes: body.themes || doc.theme,
      tags: body.tags || doc.tags,
      versionNum: 1,
      status: body.status,
      ownerId: userId,
      parentId: body.parentId ? body.parentId : null,
      fileName: body.fileName || doc.fileName,
      fileId: body.fileId || doc.fileId
    });
  } catch (err) {
    throw err
  }
}


export async function unPublished(docId: string, userObj: any) {
  try {
    if (!Types.ObjectId.isValid(docId)) throw new Error("Invalid Document Id.")
    let [isEligible, docDetail] = await Promise.all([
      checkRoleScope(userObj.role, "unpublish-document"),
      documents.findById(docId).exec()
    ])
    if (!isEligible) throw new APIError("Unauthorized Action.", 403);
    if ((docDetail as any).isPublic) {
      throw new APIError(DOCUMENT_ROUTER.UNPUBLISH_PUBLIC_DOCUMENT)
    }
    let success = await documents.findByIdAndUpdate(docId, { status: STATUS.UNPUBLISHED }, { new: true });
    await create({ activityType: `DOUCMENT_UNPUBLISHED`, activityBy: userObj._id, documentId: docId });
    let isDocExists = await checkDocIdExistsInEs(docId)
    if(isDocExists){
    let updatedData = await esClient.update({
      index: "documents",
      id: docId,
      body: {
        "script": {
          "source": "ctx._source.status=(params.status)",
          "lang": "painless",
          "params": {
            "status": STATUS.UNPUBLISHED,
          }
        }
      }
    })
  }
    mailAllCmpUsers("unPublishDocument", success)
    return success
  } catch (err) {
    throw err;
  };
};

export async function replaceDoc(docId: string, replaceDoc: string, userObj: any, siteConstants: any) {
  try {
    if (siteConstants.replaceDoc == "true") {
      let admin_scope = await checkRoleScope(userObj.role, "replace-document");
      if (!admin_scope) throw new APIError("Unauthorized Action.", 403);
      let [doc, unPublished]: any = await Promise.all([documents.findById(replaceDoc).exec(),
      documents.findByIdAndUpdate(docId, { status: STATUS.UNPUBLISHED }, { new: true }).exec()]);
      let success = await published({ ...doc, versionNum: 1, status: STATUS.PUBLISHED, ownerId: userObj._id }, doc._id, userObj, false)
      await create({ activityType: `DOUCMENT_REPLACED`, activityBy: userObj._id, documentId: docId, replaceDoc: success._id })
      mailAllCmpUsers("replaceDocument", success)
      return success
    }
    else {
      throw new APIError("Unauthorized Action.", 403)
    }
  } catch (err) {
    throw err;
  };
};

export async function publishList(userId: string, page: number = 1, limit: number = 30, host: string, pagination: boolean = true) {
  try {
    let docs = await documents.find({ ownerId: userId, status: STATUS.PUBLISHED }).sort({ updatedAt: -1 });
    let data = await Promise.all(docs.map(async (doc: any) => docData(doc, host)));
    if (pagination) {
      data = documentsSort(data, "updatedAt", true)
      return manualPagination(page, limit, data)
    }
    return data
  } catch (err) {
    throw err;
  }
}

// Get Filterd Documents
export async function docFilter(search: string, userId: string, page: number = 1, limit: number = 30, host: string, publish: boolean = true) {
  search = search.trim();
  try {
    let users: any = await getNamePatternMatch(search, { name: 1, firstName: 1, lastName: 1, middleName: 1, email: 1, emailVerified: 1, is_active: 1 })
    let userIds = users.map((user: any) => user._id)
    let collaboratedDocsIds: any = (await Promise.all(userIds.map((userId: string) => GetDocIdsForUser(userId, "user", ["collaborator"])))).reduce((main: any, curr) => main.concat(curr), [])
    let [collaboratorDocs, searchGroupIds, groups, tags]: any = await Promise.all([
      documents.find({ _id: { $in: collaboratedDocsIds }, parentId: null, isDeleted: false, ownerId: userId }).exec(),
      groupPatternMatch({}, { name: search }, {}, {}, "updatedAt"),
      userGroupsList(userId),
      Tags.find({ tag: new RegExp(search, "i") }).exec()
    ])
    searchGroupIds = searchGroupIds.map(({ _id }: any) => _id)
    let docIds: any = await Promise.all(groups.map((groupId: string) => GetDocIdsForUser(groupId, "group")));
    docIds = docIds.reduce((main: any, arr: any) => main.concat(arr), [])
    docIds = [... new Set(docIds.concat(await GetDocIdsForUser(userId)))].filter((id: any) => Types.ObjectId.isValid(id));
    let tagIds = tags.map((tag: any) => tag.id)
    let [sharedCollaboratorDocs, docsWithTag, sharedWithTag, docs, shared] = await Promise.all([
      documents.find({ _id: { $in: collaboratedDocsIds.filter((id: any) => docIds.includes(id)) }, parentId: null, isDeleted: false }).exec(),
      documents.find({ tags: { $in: tagIds }, parentId: null, isDeleted: false, ownerId: userId }).collation({ locale: 'en' }).sort({ name: 1 }).exec(),
      documents.find({ _id: { $in: docIds }, isDeleted: false, tags: { $in: tagIds } }).collation({ locale: 'en' }).sort({ name: 1 }).exec(),
      documents.find({ parentId: null, isDeleted: false, $or: [{ name: new RegExp(search, "i") }, { description: new RegExp(search, "i") }, { ownerId: { $in: userIds } }] }).collation({ locale: 'en' }).sort({ name: 1 }).exec(),
      documents.find({ _id: { $in: docIds }, isDeleted: false, $or: [{ name: new RegExp(search, "i") }, { description: new RegExp(search, "i") }, { ownerId: { $in: userIds } }] }).collation({ locale: 'en' }).sort({ name: 1 }).exec()
    ])
    let groupSearchIds: any = await Promise.all(searchGroupIds.map((groupId: string) => GetDocIdsForUser(groupId, "group")));
    groupSearchIds = groupSearchIds.reduce((main: any, arr: any) => main.concat(arr), [])
    let [groupSearchDocs, sharedGroupSearchDocs] = await Promise.all([
      documents.find({ _id: { $in: groupSearchIds }, parentId: null, isDeleted: false, ownerId: userId }).exec(),
      documents.find({ _id: { $in: groupSearchIds.filter((id: any) => docIds.includes(id)) }, parentId: null, isDeleted: false }).exec()
    ])
    let myDocs = [...docs, ...docsWithTag, ...collaboratorDocs, ...groupSearchDocs]
    let shareDocs = [...shared, ...sharedWithTag, ...sharedCollaboratorDocs, ...sharedGroupSearchDocs]
    if (publish == true) docs = [...((docs.concat(docsWithTag)).filter((doc: any) => (doc.ownerId == userId && doc.status == STATUS.DONE) || doc.status == STATUS.PUBLISHED || (doc.ownerId == userId && doc.status == STATUS.UNPUBLISHED))), ...shareDocs];
    else docs = [...myDocs.filter((doc: any) => (doc.ownerId == userId && doc.status == STATUS.DONE) || (doc.ownerId == userId && doc.status == STATUS.UNPUBLISHED)), ...shareDocs].filter(({ status }: any) => status != 2);
    docs = Object.values(docs.reduce((acc, cur) => Object.assign(acc, { [cur._id]: cur }), {}))
    let filteredDocs: any = await Promise.all(docs.map((doc: any) => docData(doc, host)));
    filteredDocs = documentsSort(filteredDocs, "name", false)
    return manualPagination(page, limit, filteredDocs)
  } catch (err) {
    throw err;
  };
};


//  Manual Pagination for Doc Filter
function filterOrdersByPageAndLimit(page: number, limit: number, orders: any): Promise<object[]> {
  let skip = ((page - 1) * limit);
  return orders.slice(skip, skip + limit);
};

export function manualPagination(page: number, limit: number, docs: any[]) {
  page = Number(page)
  limit = Number(limit)
  const skip = ((page - 1) * limit)
  return {
    page,
    pages: Math.ceil(docs.length / limit),
    docs: docs.slice(skip, skip + limit)
  }
}

export async function createFolder(body: any, userId: string) {
  try {
    let userRoles = await userRoleAndScope(userId);
    let userRole = userRoles.data[0];
    const isEligible = await checkRoleScope(userRole, "create-folder");
    if (!isEligible) {
      throw new APIError(DOCUMENT_ROUTER.NO_FOLDER_PERMISSION, 403);
    }
    if (!body.name) throw new Error(DOCUMENT_ROUTER.MANDATORY);


    // let data = await folders
    //   .find({ ownerId: userId, name: body.name });
    // if (data.length) {
    //   throw new Error(DOCUMENT_ROUTER.ALREADY_EXIST);
    // }
    let folder = await folders.create({
      name: body.name,
      parentId: body.parentId || null,
      ownerId: userId
    });
    return { folder_id: folder._id }
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function moveToFolder(folderId: string, body: any, userId: string) {
  if (!folderId || (!body.docId && !body.subFolderId)) throw new Error(DOCUMENT_ROUTER.MANDATORY);
  try {
    if (body.oldFolderId) {
      if (body.docId) {
        await folders.update({ _id: body.oldFolderId }, {
          $pull: { doc_id: body.docId }
        })
      } else if (body.subFolderId) {
        await folders.update({ _id: body.subFolderId }, {
          parentId: null
        })
      }
    }
    if (body.docId) {
      await folders.update({ _id: folderId }, {
        $push: { doc_id: body.docId }
      })
    } else if (body.subFolderId) {
      await folders.update({ _id: body.subFolderId }, {
        parentId: folderId
      })
    }
    return {
      sucess: true
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function listFolders(userId: String) {
  try {
    let data = await folders.find({ ownerId: userId, parentId: null }).collation({ locale: 'en' }).sort({ name: 1 });
    let folderList = data.map((folder: any) => {
      return {
        folderId: folder._id,
        name: folder.name,
        date: folder.createdAt
      }
    })
    return { folders: folderList };
  } catch (error) {
    console.error(error);
    throw error;
  }
}
export async function getFolderDetails(folderId: string, userId: any, page: number = 1, limit: number = 30, host: string) {
  if (!folderId) throw new Error(DOCUMENT_ROUTER.MANDATORY);
  const [fetchedDoc, subfolders] = await Promise.all([
    folders.aggregate([
      {
        $match: {
          ownerId: userId,
          _id: Types.ObjectId(folderId)
        }
      },
      // { "$unwind": "$doc_id" },
      {
        $lookup: {
          from: "documents",
          localField: "doc_id",
          foreignField: "_id",
          as: "doc_id"
        }
      },
      { $sort: { name: 1 } },
      { $unwind: { path: "$doc_id" } },
      {
        $project: {
          name: 1,
          doc_id: 1,
          createdAt: 1,
          ownerId: 1,
          parentId: 1
        }
      }
    ]).exec(),
    folders.find({ ownerId: userId, parentId: folderId }).collation({ locale: 'en' }).sort({ name: 1 }).exec()
  ])

  let subFolderList = subfolders.map((folder: any) => {
    return {
      type: 'SUB_FOLDER',
      folderId: folder._id,
      name: folder.name,
      date: folder.createdAt,
      parentId: folder.parentId
    }
  })
  const docs = await Promise.all(
    fetchedDoc.map((folder: any) => {
      return userData(folder, host);
    })
  )
  const docsList = docs.map((folder: any) => {
    return folder[0];
  })
  const filteredDocs = docsList.filter(doc => doc.isDeleted == false)
  const folderName: any = await folders.findById(folderId);
  const docsData = manualPagination(page, limit, [...subFolderList, ...filteredDocs])
  const filteredSubFolders = docsData.docs.filter(doc => doc.type == 'SUB_FOLDER')
  docsData.docs = docsData.docs.filter(doc => doc.type != 'SUB_FOLDER')
  return { page: docsData.page, pages: docsData.pages, folderName: folderName.name, subFoldersList: filteredSubFolders, docsList: docsData.docs, };
}

async function userData(folder: any, host: string) {
  try {
    let fileType = folder.doc_id.fileName ? (folder.doc_id.fileName.split(".")).pop() : ""
    const [tags, userRole, owner] = await Promise.all([
      // getTags(folder.doc_id.tags),
      getTags((folder.doc_id.tags && folder.doc_id.tags.length) ? folder.doc_id.tags.filter((tag: string) => Types.ObjectId.isValid(tag)) : []),
      userRoleAndScope(folder.doc_id.ownerId),
      userFindOne("id", folder.doc_id.ownerId, { firstName: 1, middleName: 1, lastName: 1, email: 1 })
    ])
    const data = await Promise.all([{
      _id: folder.doc_id._id,
      name: folder.doc_id.name,
      fileId: folder.doc_id.fileId,
      fileName: folder.doc_id.fileName,
      description: folder.doc_id.description,
      tags,
      role: ((userRole as any).data || [""])[0],
      owner,
      thumbnail: (fileType == "jpg" || fileType == "jpeg" || fileType == "png") ? `${host}/api/docs/get-document/${folder.doc_id.fileId}` : "N/A",
      date: folder.doc_id.createdAt,
      isDeleted: folder.doc_id.isDeleted
    }])
    return data

  } catch (err) {
    throw err;
  }
}

export async function deleteFolder(folderId: string, userId: string) {
  try {
    if (!folderId) throw new Error(DOCUMENT_ROUTER.MANDATORY);
    const folderDetails = await folders.find({ _id: folderId });
    if (!folderDetails.length) {
      throw new Error("Folder doesnot exist")
    }
    let folderData = folderDetails.map((folder: any) => {
      return {
        parentId: folder.parentId,
        doc_id: folder.doc_id
      }
    });
    const parentId = folderData[0].parentId ? folderData[0].parentId : null
    let doc_id = folderData[0].doc_id.length ? folderData[0].doc_id : []
    doc_id = JSON.parse(JSON.stringify(doc_id))
    const data = await Promise.all([
      folders.remove({ _id: folderId, ownerId: userId }).exec(),
      folders.update({ parentId: folderId }, {
        parentId: parentId
      }, { "multi": true }).exec(),
      folders.update({ _id: parentId }, {
        $addToSet: { doc_id: doc_id },
      }, { "multi": true }).exec()
    ])

    if (data) {
      return { success: true }
    }
  } catch (err) {
    throw err;
  }
}
export async function removeFromFolder(folderId: string, body: any, userId: string) {
  if (!folderId || (!body.docId && !body.subFolderId)) throw new Error(DOCUMENT_ROUTER.MANDATORY);
  try {
    if (body.docId) {
      await folders.update({ _id: folderId }, {
        $pull: { doc_id: body.docId }
      })
    } else if (body.subFolderId) {
      await folders.update({ _id: body.subFolderId }, {
        parentId: null
      })
    }
    return {
      sucess: true
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function deleteDoc(docId: any, userId: string) {
  try {
    let userRoles = await userRoleAndScope(userId);
    let userRole = userRoles.data[0];

    const isEligible = await checkRoleScope(userRole, "delete-doc");
    if (!isEligible) {
      throw new APIError(DOCUMENT_ROUTER.NO_DELETE_PERMISSION, 403);
    }

    if (!Types.ObjectId.isValid(docId))
      throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID);
    let findDoc: any = await documents.findOne({ _id: docId, ownerId: userId })
    if (!findDoc) {
      throw new Error("File Id is Invalid")
    }
    if (findDoc.status == 2) throw new Error("Published document can't be deleted.")
    let deletedDoc = await documents.update({ _id: docId, ownerId: userId }, { isDeleted: true }).exec()
    await create({ activityType: "DOCUMENT_DELETED", activityBy: userId, documentId: docId })
    let isDocExists = await checkDocIdExistsInEs(docId)
    if(isDocExists){
    let deleted =await esClient.delete({
      index: 'documents',
      id: docId,
    })
  }
    if (deletedDoc) {
      return {
        success: true,
        mesage: "File deleted successfully"
      }
    }

  } catch (err) {
    console.error(err);
    throw err;
  };
};

export async function getListOfFoldersAndFiles(userId: any, page: number = 1, limit: number = 30, host: string) {

  const [foldersData, folderDocs, fetchedDoc] = await Promise.all([
    folders.find({ ownerId: userId, parentId: null }).collation({ locale: 'en' }).sort({ name: 1 }).exec(),
    folders.find({ ownerId: userId }).collation({ locale: 'en' }).sort({ name: 1 }).exec(),
    documents.find({ ownerId: userId, parentId: null, isDeleted: false, status: { $ne: STATUS.DRAFT } }).collation({ locale: 'en' }).sort({ name: 1 }).exec(),
  ])
  let folder_files = folderDocs.map((folder: any) => {
    return folder.doc_id
  })
  var merged = [].concat.apply([], folder_files);
  let folderDocIds = JSON.parse(JSON.stringify(merged));

  let foldersList = foldersData.map((folder: any) => {
    return {
      type: 'FOLDER',
      folderId: folder._id,
      name: folder.name,
      date: folder.createdAt,
      parentId: folder.parentId
    }
  })
  const docList = await Promise.all(fetchedDoc.map((doc) => {
    return docData(doc, host);
  })
  );
  var docsList = docList.filter((docs) => {
    return !folderDocIds.some((folderDocs: any) => {
      return docs._id == folderDocs;
    });
  })
  const docsData = manualPagination(page, limit, [...foldersList, ...docsList])
  const filteredFolders = docsData.docs.filter(doc => doc.type == 'FOLDER')
  docsData.docs = docsData.docs.filter(doc => doc.type != 'FOLDER')
  docsData.docs = documentsSort(docsData.docs, "updatedAt", true)
  return { page: docsData.page, pages: docsData.pages, foldersList: filteredFolders, docsList: docsData.docs };
}


export async function checkCapabilitiesForUserNew(objBody: any, userId: string) {
  try {
    let { docIds, userIds } = objBody
    if (!Array.isArray(docIds) || !Array.isArray(userIds)) throw new Error("Must be an Array.");
    // if (objBody.unique) {
    //   if (userIds.some((user) => userIds.indexOf(user) !== userIds.lastIndexOf(user))) {
    //     throw new Error("Duplicate user ids found.");
    //   };
    // };
    let userObjects = (await userFindMany("_id", [... new Set(userIds.concat(userId))])).map((user: any) => { return { ...user, type: "user" } })
    return await Promise.all(docIds.map(docId => loopUsersAndFetchDataNew(docId, userIds, userId, userObjects)))
  } catch (err) {
    throw err
  };
};

export async function checkCapabilitiesForUser(objBody: any, userId: string) {
  try {
    let { docIds, userIds } = objBody
    if (!Array.isArray(docIds) || !Array.isArray(userIds)) throw new Error("Must be an Array.");
    // if (objBody.unique) {
    //   if (userIds.some((user) => userIds.indexOf(user) !== userIds.lastIndexOf(user))) {
    //     throw new Error("Duplicate user ids found.");
    //   };
    // };
    let obj = await Promise.all(docIds.map(docId => loopUsersAndFetchData(docId, userIds, userId)))
    let mainObj = obj.reduce((main: any, curr: any) => Object.assign({}, main, curr), {})
    let noAccessDocs = docIds.filter(docid => !Object.keys(mainObj).includes(docid))
    return Object.assign(mainObj, { noAccessDocuments: noAccessDocs, documents: await documents.find({ _id: { $in: Object.keys(mainObj).concat(noAccessDocs) } }) })
  } catch (err) {
    throw err
  };
};

async function loopUsersAndFetchDataNew(docId: string, userIds: string[], userId: string, userObjects: any[]) {
  try {
    return {
      document: await documents.findById(docId).exec(),
      attachedBy: { ...(userObjects.find(user => user._id == userId)), docRole: (await documnetCapabilities(docId, userId) as any || [""])[0], type: "user" },
      users: await Promise.all(userIds.map(userId => userWithDocRole(docId, userId, userObjects)))
    }
  } catch (err) {
    throw err;
  }
};


async function loopUsersAndFetchData(docId: string, userIds: string[], userId: string) {
  let userCapabilities: any = await documnetCapabilities(docId, userId)
  if (["no_access", "viewer"].includes(userCapabilities[0])) return {}
  const s = await Promise.all(userIds.map(user => documnetCapabilities(docId, user)))
  let users = await userFindMany("_id", userIds)
  const filteredusers = users.map((user: any) => user._id)
  let groupIds = userIds.filter(id => !filteredusers.includes(id))
  return {
    [docId]: s.map((s1: any, i) => {
      if (s1.includes('no_access')) {
        return { _id: userIds[i], type: groupIds.includes(userIds[i]) ? "group" : "user" }
      }
      return { _id: false }
    }).filter(({ _id }: any) => Types.ObjectId.isValid(_id))
  };
};


async function userWithDocRole(docId: string, userId: string, usersObjects: any[]) {
  try {
    let user = usersObjects.find(user => user._id == userId)
    if (!user) user = { ...(await groupFindOne("_id", userId)), type: "group" }
    return {
      ...(user),
      docRole: (await documnetCapabilities(docId, userId) as any || [""])[0]
    }
  } catch (err) {
    throw err
  };
};

export async function shareDocForUsersNew(obj: any, userObj: any) {
  try {
    if ("add" in obj && obj.add.length) {
      await Promise.all(obj.add.map((obj: any) => invitePeople(obj.docId, [{ _id: obj.userId, type: obj.type }], obj.role, userObj._id)))
    } if ("edit" in obj && obj.edit.length) {
      await Promise.all(obj.edit.map((obj: any) => invitePeopleEdit(obj.docId, obj.userId, obj.type, obj.role, userObj)))
    } if ("remove" in obj && obj.edit.length) {
      await Promise.all(obj.edit.map((obj: any) => invitePeopleRemove(obj.docId, obj.userId, obj.type, obj.role, userObj)))
    }
    return { message: "successfully updated the roles." }
  } catch (err) {
    throw err
  };
};

export async function shareDocForUsers(obj: any) {
  try {
    if (!obj) throw new Error("Missing data.")
    if (Object.keys(obj).length) {
      if (obj.noAccessDocuments) delete obj.noAccessDocuments
      if (obj.documents) delete obj.documents
      await Promise.all((Object.keys(obj)).map((docId: string) => loopForAddCapability(docId, obj[docId])))
    }
    return { message: "shared successfully" }
  } catch (err) {
    throw err
  };
};

async function loopForAddCapability(docId: string, users: any[]) {
  try {
    const role = "viewer"
    let doc = await documents.findById(docId)
    await Promise.all(users.map(userObj => invite(userObj, docId, role, doc)))
  } catch (err) {
    throw err
  };
};

export async function suggestTags(docId: string, body: any, userId: string) {
  try {
    let userRoles = await userRoleAndScope(userId);
    let userRole = userRoles.data[0];
    const isEligible = await checkRoleScope(userRole, "suggest-tag");
    if (!isEligible) {
      throw new APIError("Unauthorized Access", 403);
    }
    if (!body.tags) { throw new Error("Tags is required field") }
    let [docData, child]: any = await Promise.all([documents.findById(docId).exec(), documents.find({ parentId: docId, isDeleted: false }).sort({ createdAt: -1 }).exec()])
    if (!docData) throw new Error("Doc not found");
    if (!child.length) throw new Error(DOCUMENT_ROUTER.CHILD_NOT_FOUND);
    let usersData = await userFindMany("_id", [docData.ownerId, userId], { firstName: 1, middleName: 1, lastName: 1, email: 1 })
    let ownerDetails = usersData.find((user: any) => docData.ownerId == user._id)
    let ownerName = `${ownerDetails.firstName} ${ownerDetails.middleName || ""} ${ownerDetails.lastName || ""}`;
    let userDetails = usersData.find((user: any) => userId == user._id)
    let userName = `${userDetails.firstName} ${userDetails.middleName || ""} ${userDetails.lastName || ""}`;
    let [doc, childUpdate]: any = await Promise.all([
      documents.findByIdAndUpdate(docId, { "$push": { suggestedTags: { userId: userId, tags: body.tags } } }).exec(),
      documents.findByIdAndUpdate(child[child.length - 1]._id, { "$push": { suggestedTags: { userId: userId, tags: body.tags } } }).exec()
    ]);
    if (doc) {
      const { mobileNo, fullName } = getFullNameAndMobile(userDetails);
      sendNotification({ id: userId, fullName: ownerName, userName, mobileNo, email: ownerDetails.email, documentUrl: `${ANGULAR_URL}/home/resources/doc/${docId}`, templateName: "suggestTagNotification", mobileTemplateName: "suggestTagNotification" });
      return {
        sucess: true,
        message: "Tag suggested successfully"
      }
    }
  } catch (err) {
    throw err
  };
};

async function userInfo(docData: any) {
  try {
    return {
      ...docData,
      tags: await getTags((docData.tags && docData.tags.length) ? docData.tags.filter((tag: string) => Types.ObjectId.isValid(tag)) : []),
      user: await userFindOne("id", docData.userId, { firstName: 1, middleName: 1, lastName: 1, email: 1 }),
      role: ((await userRoleAndScope(docData.userId)) as any).data[0]
    };
  } catch (err) {
    throw err;
  }
}

export async function approveTags(docId: string, body: any, userId: string, ) {
  try {
    if (!docId || !body.userId || (!body.tagIdToAdd && !body.tagIdToRemove)) { throw new Error("All mandatory fields are missing") }
    let docdetails: any = await documents.findById(docId)
    if (!docdetails) { throw new Error("DocId is Invalid") }
    let usersData = await userFindMany("_id", [userId, body.userId], { firstName: 1, middleName: 1, lastName: 1, email: 1 })
    let ownerDetails = usersData.find((user: any) => userId == user._id)
    let ownerName = `${ownerDetails.firstName} ${ownerDetails.middleName || ""} ${ownerDetails.lastName || ""}`;
    let userDetails = usersData.find((user: any) => body.userId == user._id)
    let userName = `${userDetails.firstName} ${userDetails.middleName || ""} ${userDetails.lastName || ""}`;
    if (body.tagIdToAdd) {
      let [filteredDoc, filteredDoc1]: any = await Promise.all([
        docdetails.suggestTagsToAdd.filter((tag: any) => tag.userId == body.userId).map(
          (_respdata: any) => {
            return {
              userId: _respdata.userId,
              tags: _respdata.tags.filter((tag: any) => tag != body.tagIdToAdd)
            }
          }),
        docdetails.suggestTagsToAdd.filter((tag: any) => tag.userId != body.userId).map(
          (_respdata: any) => {
            return {
              userId: _respdata.userId,
              tags: _respdata.tags
            }
          })
      ])
      let filteredDocs = [...filteredDoc, ...filteredDoc1]
      let doc = await documents.findByIdAndUpdate(docId, { suggestTagsToAdd: filteredDocs, "$push": { tags: body.tagIdToAdd } })
      let tags: any = await getTags([body.tagIdToAdd])
      let tagNames = tags.map((tag: any) => { return tag.tag })
      let isDocExists = await checkDocIdExistsInEs(docId)
    if(isDocExists){
      let updatedData = await esClient.update({
        index: "documents",
        id: docId,
        body: {
          "script": {
            "source": "ctx._source.tags.addAll(params.tags)",
            "lang": "painless",
            "params": {
              "tags": tagNames,
            }
          }
        }
      })
    }
      if (doc) {
        const { mobileNo, fullName } = getFullNameAndMobile(userDetails);
        sendNotification({ id: userId, fullName: ownerName, userName, mobileNo, email: userDetails.email, documentUrl: `${ANGULAR_URL}/home/resources/doc/${docId}`, templateName: "approveTagNotification", mobileTemplateName: "approveTagNotification" });
        return {
          sucess: true,
          message: "Tag Adding approved successfully"
        }
      }
    }
    if (body.tagIdToRemove) {
      let [suggestedToRemove, suggestedToRemove1]: any = await Promise.all([
        docdetails.suggestTagsToRemove.filter((tag: any) => tag.userId == body.userId).map(
          (_respdata: any) => {
            return {
              userId: _respdata.userId,
              tags: _respdata.tags.filter((tag: any) => tag != body.tagIdToRemove)
            }
          }),
        docdetails.suggestTagsToRemove.filter((tag: any) => tag.userId != body.userId).map(
          (_respdata: any) => {
            return {
              userId: _respdata.userId,
              tags: _respdata.tags
            }
          })
      ])
      let filteredDocsRemove = [...suggestedToRemove, ...suggestedToRemove1]
      let doc = await documents.findByIdAndUpdate(docId, { suggestTagsToRemove: filteredDocsRemove, "$pull": { tags: body.tagIdToRemove } })
      let tags: any = await getTags([body.tagIdToRemove])
      let tagNames = tags[0].tag
      let isDocExists = await checkDocIdExistsInEs(docId)
    if(isDocExists){
      let updatedData = await esClient.update({
        index: "documents",
        id: docId,
        body: {
          "script": {
            "inline": "ctx._source.tags.remove(ctx._source.tags.indexOf(params.tags))",
            // "source": "ctx._source.tags.addAll(params.tags)",
            "lang": "painless",
            "params": {
              "tags": tagNames,
            }
          }
        }
      })
    }
      if (doc) {
        const { mobileNo, fullName } = getFullNameAndMobile(userDetails);
        sendNotification({ id: userId, fullName: ownerName, userName, mobileNo, email: userDetails.email, documentUrl: `${ANGULAR_URL}/home/resources/doc/${docId}`, templateName: "approveTagNotification", mobileTemplateName: "approveTagNotification" });
        return {
          sucess: true,
          message: "Tag Removal approved successfully"
        }
      }
    }
  } catch (err) {
    throw err
  };
};

export async function rejectTags(docId: string, body: any, userId: string, ) {
  try {
    if (!docId || !body.userId || (!body.tagIdToAdd && !body.tagIdToRemove)) { throw new Error("All mandatory fields are missing") }
    let docdetails: any = await documents.findById(docId)
    if (!docdetails) { throw new Error("DocId is Invalid") }
    let usersData = await userFindMany("_id", [userId, body.userId], { firstName: 1, middleName: 1, lastName: 1, email: 1 })
    let ownerDetails = usersData.find((user: any) => userId == user._id)
    let ownerName = `${ownerDetails.firstName} ${ownerDetails.middleName || ""} ${ownerDetails.lastName || ""}`;
    let userDetails = usersData.find((user: any) => body.userId == user._id)
    let userName = `${userDetails.firstName} ${userDetails.middleName || ""} ${userDetails.lastName || ""}`;
    if (body.tagIdToAdd) {
      let [filteredDoc, filteredDoc1]: any = await Promise.all([
        docdetails.suggestTagsToAdd.filter((tag: any) => tag.userId == body.userId).map(
          (_respdata: any) => {
            return {
              userId: _respdata.userId,
              tags: _respdata.tags.filter((tag: any) => tag != body.tagIdToAdd)
            }
          }),
        docdetails.suggestTagsToAdd.filter((tag: any) => tag.userId != body.userId).map(
          (_respdata: any) => {
            return {
              userId: _respdata.userId,
              tags: _respdata.tags
            }
          })
      ])
      let filteredDocs = [...filteredDoc, ...filteredDoc1]

      let doc = await documents.findByIdAndUpdate(docId, {
        suggestTagsToAdd: filteredDocs,
        "$push": {
          rejectedTags: { userId: body.userId, tags: body.tagId }
        }
      })
      if (doc) {
        const { mobileNo, fullName } = getFullNameAndMobile(userDetails);
        sendNotification({ id: userId, fullName: ownerName, userName, mobileNo, email: userDetails.email, documentUrl: `${ANGULAR_URL}/home/resources/doc/${docId}`, templateName: "rejectTagNotification", mobileTemplateName: "rejectTagNotification" });
        return {
          sucess: true,
          message: "Tag Adding Rejected"
        }
      }
    }
    if (body.tagIdToRemove) {
      let [filteredDoc, filteredDoc1]: any = await Promise.all([
        docdetails.suggestTagsToRemove.filter((tag: any) => tag.userId == body.userId).map(
          (_respdata: any) => {
            return {
              userId: _respdata.userId,
              tags: _respdata.tags.filter((tag: any) => tag != body.tagIdToRemove)
            }
          }),
        docdetails.suggestTagsToRemove.filter((tag: any) => tag.userId != body.userId).map(
          (_respdata: any) => {
            return {
              userId: _respdata.userId,
              tags: _respdata.tags
            }
          })
      ])
      let filteredDocs = [...filteredDoc, ...filteredDoc1]

      let doc = await documents.findByIdAndUpdate(docId, {
        suggestTagsToRemove: filteredDocs,
      })
      if (doc) {
        const { mobileNo, fullName } = getFullNameAndMobile(userDetails);
        sendNotification({ id: userId, fullName: ownerName, userName, mobileNo, email: userDetails.email, documentUrl: `${ANGULAR_URL}/home/resources/doc/${docId}`, templateName: "rejectTagNotification", mobileTemplateName: "rejectTagNotification" });
        return {
          sucess: true,
          message: "Tag Removing Rejected"
        }
      }
    }
  } catch (err) {
    throw err
  };
};

async function mailAllCmpUsers(type: string, docDetails: any, allcmp: boolean = true, text?: any) {
  try {
    let selectFields = { email: true, firstName: true, middleName: true, lastName: true, phone: true }
    let users, sharedUsers: string, role: string
    if (allcmp) {
      users = await userList({ is_active: true, emailVerified: true }, selectFields)
    } else {
      let docInvited: any = await invitePeopleList(docDetails._id)
      if (Array.isArray(text)) docInvited.concat(text)
      let userIds = docInvited.filter((obj: any) => obj.type == "user").map(({ id }: any) => id)
      let groupIds = docInvited.filter((obj: any) => obj.type == "group").map(({ id }: any) => id)
      let groupUsers = await Promise.all(groupIds.map((group: string) => groupUserList(group)));
      userIds = userIds.concat(groupUsers.reduce((main: any[], curr: any) => main.concat(curr), []))
      users = await userFindMany("_id", userIds, selectFields);
      if (type == "invitePeopleDoc" || type == "invitePeopleEditDoc" || type == "invitePeopleRemoveDoc") {
        let actionedUsers = users.filter((user: any) => text.some((acUser: any) => acUser.id == user._id)).map((user: any) => `${user.firstName} ${user.middleName || ""} ${user.lastName || ""}`).join()
        users = users.filter((user: any) => text.some((acUser: any) => acUser.id != user._id))
        sharedUsers = actionedUsers.length == 1 ? actionedUsers[0] : `${actionedUsers.slice(0, actionedUsers.lastIndexOf(",")) + " and " + actionedUsers.slice(actionedUsers.lastIndexOf(",") + 1)}`
        role = text[0].role
      }
    }
    if (users.length) {
      let allMailContent = await Promise.all(users.map(async (user: any) => {
        let fullName = `${user.firstName} ${user.middleName || ""} ${user.lastName || ""}`;
        sendNotification({
          id: user._id,
          fullName, text,
          sharedUsers, role,
          mobileNo: user.phone,
          email: user.email,
          documentName: docDetails.name,
          documentUrl: `${ANGULAR_URL}/home/resources/doc/${docDetails._id}`,
          templateName: type,
          mobileTemplateName: type
        });
      }));
      return true
    }
    return false
  } catch (err) {
    throw err;
  };
};

export async function deleteSuggestedTag(docId: string, body: any, userId: string, ) {
  try {
    if (!docId || (!body.tagIdToAdd && !body.tagIdToRemove)) { throw new Error("All mandatory fields are missing") }
    let docdetails: any = await documents.findById(docId)
    if (!docdetails) { throw new Error("DocId is Invalid") }
    if (body.tagIdToAdd) {
      let [filteredDoc, filteredDoc1]: any = await Promise.all([
        docdetails.suggestTagsToAdd.filter((tag: any) => tag.userId == userId).map(
          (_respdata: any) => {
            return {
              userId: _respdata.userId,
              tags: _respdata.tags.filter((tag: any) => tag != body.tagIdToAdd)
            }
          }),
        docdetails.suggestTagsToAdd.filter((tag: any) => tag.userId != userId).map(
          (_respdata: any) => {
            return {
              userId: _respdata.userId,
              tags: _respdata.tags
            }
          })
      ])
      let filteredDocs = [...filteredDoc, ...filteredDoc1]

      let doc = await documents.findByIdAndUpdate(docId, {
        suggestTagsToAdd: filteredDocs
      })
      if (doc) {
        return {
          sucess: true,
          message: "Tag removed Successfully"
        }
      }
    }
    if (body.tagIdToRemove) {
      let [filteredDoc, filteredDoc1]: any = await Promise.all([
        docdetails.suggestTagsToRemove.filter((tag: any) => tag.userId == userId).map(
          (_respdata: any) => {
            return {
              userId: _respdata.userId,
              tags: _respdata.tags.filter((tag: any) => tag != body.tagIdToRemove)
            }
          }),
        docdetails.suggestTagsToRemove.filter((tag: any) => tag.userId != userId).map(
          (_respdata: any) => {
            return {
              userId: _respdata.userId,
              tags: _respdata.tags
            }
          })
      ])
      let filteredDocs = [...filteredDoc, ...filteredDoc1]

      let doc = await documents.findByIdAndUpdate(docId, {
        suggestTagsToRemove: filteredDocs
      })
      if (doc) {
        return {
          sucess: true,
          message: "Tag removed Successfully"
        }
      }
    }
  } catch (err) {
    throw err
  };
};
export async function getAllRequest(docId: string) {
  try {
    if (!Types.ObjectId.isValid(docId)) throw new Error("Invalid Document Id.")
    let requestData = await docRequestModel.find({ docId: Types.ObjectId(docId), isDelete: false }).populate(docId)
    return await Promise.all(requestData.map((request: any) => RequestList(request.toJSON())))
  } catch (err) {
    throw err;
  };
};

async function RequestList(request: any) {
  try {
    return { ...request, requestedBy: await userFindOne("id", request.requestedBy, {}) }
  } catch (err) {
    throw err
  };
};

export async function requestAccept(requestId: string, userObj: any) {
  try {
    if (!Types.ObjectId.isValid(requestId)) throw new Error("Invalid Document Id.");
    let requestDetails: any = await docRequestModel.findById(requestId).populate("docId").exec();
    if (userObj._id != requestDetails.docId.ownerId) throw new Error("Unauthorized Action.");
    let capability: any[] = await documnetCapabilities(requestDetails.docId.id, requestDetails.requestedBy);
    let addedCapability;
    if (capability.includes("no_access")) {
      addedCapability = await shareDoc(requestDetails.requestedBy, "user", requestDetails.docId.id, "viewer")
    } else if (capability.includes("viewer")) {
      let userCapability = await GetDocCapabilitiesForUser(requestDetails.requestedBy, requestDetails.docId.id)
      if (userCapability.length) await groupsRemovePolicy(`user/${requestDetails.requestedBy}`, requestDetails.docId.id, "viewer");
      addedCapability = await groupsAddPolicy(`user/${requestDetails.requestedBy}`, requestDetails.docId.id, "collaborator");
    } else {
      throw new Error("Invalid Action Performed.")
    }
    if (addedCapability && addedCapability.user.length) {
      await docRequestModel.findByIdAndUpdate(requestId, { $set: { isDelete: true } })
      return { message: "Shared successfully." }
    }
    throw new Error("Unable to Fecth Data.")
  } catch (err) {
    throw err;
  };
};

export async function requestDenied(requestId: string, userObj: any) {
  try {
    if (!Types.ObjectId.isValid(requestId)) throw new Error("Invalid Document Id.");
    let requestDetails: any = await docRequestModel.findById(requestId).populate("docId").exec();
    if (userObj._id != requestDetails.docId.ownerId) throw new Error("Unauthorized Action.");
    return await docRequestModel.findByIdAndUpdate(requestId, { $set: { isDelete: true } }, {})
  } catch (err) {
    throw err;
  }
}

export async function requestRaise(docId: string, userId: string) {
  try {
    if (!Types.ObjectId.isValid(docId) || !Types.ObjectId.isValid(userId)) throw new Error("Invalid Document Id or User Id.");
    let existRequest = await docRequestModel.findOne({ requestedBy: userId, docId: docId, isDelete: false })
    if (existRequest) throw new Error("already request is there.")
    return await docRequestModel.create({ requestedBy: userId, docId: docId })
  } catch (err) {
    throw err;
  }
}

//  Get All Cmp Documents List
export async function getAllCmpDocs(page: number = 1, limit: number = 30, host: string, userId: string, pagination: boolean = true) {
  try {
    let userRoles = await userRoleAndScope(userId);
    let userRole = userRoles.data[0];
    const isEligible = await checkRoleScope(userRole, "view-all-cmp-documents");
    if (!isEligible) {
      throw new APIError("Unauthorized access", 403);
    }
    let data = await documents.find({ parentId: null, status: { $ne: STATUS.DRAFT } }).sort({ updatedAt: -1 });
    const docList = await Promise.all(data.map(async doc => docData(doc, host)));
    if (pagination) return manualPagination(page, limit, docList)
    return docList
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function replaceDocumentUser(ownerId: string, newOwnerId: string, userObj: any) {
  try {
    let sharedDocIds = (await GetDocIdsForUser(ownerId)).filter(id => Types.ObjectId.isValid(id))
    let [mydocs, sharedDocs]: any = await Promise.all([
      documents.find({ ownerId: ownerId, parentId: null, isDeleted: false, status: { $ne: STATUS.DRAFT } }).exec(),
      documents.find({ _id: { $in: sharedDocIds }, isDeleted: false }).exec()
    ])
    await Promise.all(mydocs.map((doc: any) => changeOwnerShip(doc, ownerId, newOwnerId, userObj)))
    // await Promise.all(sharedDocs.map((doc: any) => changeSharedOwnerShip(doc, ownerId, newOwnerId, userObj)))
    return { success: true }
  } catch (err) {
    throw err;
  };
};
async function changeOwnerShip(doc: any, ownerId: string, newOwnerId: string, userObj: any) {
  try {
    let capability: any[] = await documnetCapabilities(doc._id, newOwnerId)
    if (["no_access", "publish", "viewer"].includes(capability[0])) {
      let document = await groupsAddPolicy(`user/${newOwnerId}`, doc._id, "collaborator")
      // await create({
      //   activityType: "CHANGE_OWNERSHIP",
      //   activityBy: userObj._id,
      //   documentId: doc._id,
      //   documentAddedUsers: [{ id: newOwnerId, type: "user", role: "owner" }],
      //   documentRemovedUsers: [{ id: ownerId, type: "user", role: "owner" }]
      // })
    }
    return { success: true, doc: doc._id }
  } catch (err) {
    throw err
  };
};

async function changeSharedOwnerShip(doc: any, ownerId: string, newOwnerId: string, userObj: any) {
  try {
    let [addingUserCapability, existingUserCapability]: any = await Promise.all([
      documnetCapabilities(doc._id, newOwnerId),
      documnetCapabilities(doc._id, ownerId)
    ])
    const newOwnerCapabilityNumber = getCapabilityPriority(addingUserCapability[0])
    const oldOwnerCapabilityNumber = getCapabilityPriority(existingUserCapability[0])
    // Removing existing user capability for the doc
    await groupsRemovePolicy(`user/${ownerId}`, doc._id, existingUserCapability[0])
    // If the Old user capability is higher than adding user capability
    if (oldOwnerCapabilityNumber > newOwnerCapabilityNumber) {
      if (newOwnerCapabilityNumber) await groupsRemovePolicy(`user/${newOwnerId}`, doc._id, addingUserCapability[0])
      await groupsAddPolicy(`user/${newOwnerId}`, doc._id, existingUserCapability[0])
    }
    await create({
      activityType: "REPLACE_USER",
      activityBy: userObj._id,
      documentId: doc._id,
      documentAddedUsers: [{ id: newOwnerId, type: "user", role: existingUserCapability[0] }],
      documentRemovedUsers: [{ id: ownerId, type: "user", role: existingUserCapability[0] }]
    })
    return true
  } catch (err) {
    throw err;
  };
};

function getCapabilityPriority(capability: string) {
  let capabilityNumber = 1
  switch (capability) {
    case 'collaborator':
      capabilityNumber = 2
      break;
    case 'owner':
      capabilityNumber = 3
      break;
    case 'no_access':
      capabilityNumber = 0
      break;
    default:
      break;
  }
  return capabilityNumber
}


export async function getAllPublicDocuments(userRole: string, currentPage = 1, limit = 20, host: string) {
  // const isEligible = await checkRoleScope(userRole, 'view-all-public-documents')
  // if(!isEligible){
  //   throw new APIError(DOCUMENT_ROUTER.VIEW_PUBLIC_DOCS_DENIED)
  // }
  let { docs, page, pages } = await documents.paginate({ isPublic: true }, { page: currentPage, limit })
  docs = await Promise.all(docs.map(doc => docData(doc, host)))
  return {
    docs,
    page,
    pages
  }
}

export async function markDocumentAsPublic(docId: string, userRole: string) {
  const [isEligible, docDetail] = await Promise.all([
    checkRoleScope(userRole, 'mark-as-public-document'),
    documents.findById(docId).exec()
  ])
  if (!isEligible) {
    throw new APIError(DOCUMENT_ROUTER.VIEW_PUBLIC_DOCS_DENIED)
  }
  if ((docDetail as any).status != 2) {
    throw new APIError(DOCUMENT_ROUTER.UNABLE_TO_MAKE_PUBLIC_DOCUMENT)
  }
  await documents.findByIdAndUpdate(docId, { $set: { isPublic: true } }).exec()
  await documents.updateMany({ parentId: docId }, { $set: { isPublic: true } }).exec()
  return { message: 'success' }
}

export async function markDocumentAsUnPublic(docId: string, userRole: string) {
  const [isEligible, docDetail] = await Promise.all([
    checkRoleScope(userRole, 'mark-as-unpublic-document'),
    documents.findById(docId).exec()
  ])
  if (!isEligible) {
    throw new APIError(DOCUMENT_ROUTER.VIEW_PUBLIC_DOCS_DENIED)
  }
  await documents.findByIdAndUpdate(docId, { $set: { isPublic: false } }).exec()
  await documents.updateMany({ parentId: docId }, { $set: { isPublic: false } }).exec()
  return { message: 'success' }
}

export async function suggestTagsToAddOrRemove(docId: string, body: any, userId: string) {
  try {

    let userRoles = await userRoleAndScope(userId);
    let userRole = userRoles.data[0];
    const isEligible = await checkRoleScope(userRole, "suggest-tag");
    if (!isEligible) {
      throw new APIError("Unauthorized Access", 403);
    }
    if (!body.addTags && !body.removeTags) { throw new Error("Required Mandatory fields") }
    let [docData, child]: any = await Promise.all([documents.findById(docId).exec(), documents.find({ parentId: docId, isDeleted: false }).sort({ createdAt: -1 }).exec()])
    if (!docData) throw new Error("Doc not found");
    if (!child.length) throw new Error(DOCUMENT_ROUTER.CHILD_NOT_FOUND);
    let usersData = await userFindMany("_id", [docData.ownerId, userId], { firstName: 1, middleName: 1, lastName: 1, email: 1 })
    let ownerDetails = usersData.find((user: any) => docData.ownerId == user._id)
    let ownerName = `${ownerDetails.firstName} ${ownerDetails.middleName || ""} ${ownerDetails.lastName || ""}`;
    let userDetails = usersData.find((user: any) => userId == user._id)
    let userName = `${userDetails.firstName} ${userDetails.middleName || ""} ${userDetails.lastName || ""}`;
    let [doc, childUpdate]: any = await Promise.all([
      documents.findByIdAndUpdate(docId, {
        "$push":
        {
          suggestTagsToAdd: { userId: userId, tags: body.addTags },
          suggestTagsToRemove: { userId: userId, tags: body.removeTags }
        }
      }).exec(),
      documents.findByIdAndUpdate(child[child.length - 1]._id, {
        "$push":
        {
          suggestTagsToAdd: { userId: userId, tags: body.addTags },
          suggestedTagsToRemove: { userId: userId, tags: body.removeTags }
        }
      }).exec()
    ]);
    if (doc) {
      const { mobileNo, fullName } = getFullNameAndMobile(userDetails);
      sendNotification({ id: userId, fullName: ownerName, userName, mobileNo, email: ownerDetails.email, documentUrl: `${ANGULAR_URL}/home/resources/doc/${docId}`, templateName: "suggestTagNotification", mobileTemplateName: "suggestTagNotification" });
      return {
        sucess: true,
        message: "Tag suggested successfully"
      }
    }
  } catch (err) {
    throw err
  };
};
export async function renameFolder(folderId: string, body: any, userId: string) {
  try {
    // let folderId =  Types.ObjectId(id)
    if (!body.name) throw new Error(DOCUMENT_ROUTER.MANDATORY);
    let folder = await folders.findByIdAndUpdate({ _id: folderId, ownerId: userId }, { name: body.name }, { new: true }).exec()
    return { success: true, folder: folder }
  } catch (error) {
    console.error(error);
    throw error;
  }
}
export async function searchDoc(search: string, userId: string) {
  try {
    let data = {
      query: {
        bool: {
          "should": [
            {
              "bool": {
                "must": [
                  {
                    multi_match: {
                      "query": search,
                      "fields": ['name', 'description', 'userName', 'tags', 'type']
                    }
                  },
                  {
                    multi_match: {
                      "query": `${userId} 2`, 
                      "fields": ['accessedBy', 'status']
                      // accessedBy: userId,
                    }
                  }
                ]
              }
            }
          ]
        }
      }
    }

    let searchdoc:any = await esClient.search({
      index: "documents",
      body: data
    });
    console.log(searchdoc);
    let seachResult = searchdoc.hits.hits.map((doc:any)=>{return doc._source})
    return seachResult
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function updateUserInDOcs(id: any, userId: string) {
  try {
    // let userIds, userNames;
    let collaboratedDocsIds: any = await GetDocIdsForUser(id, "user", ["collaborator", "owner"])
    let userIds = await Promise.all(collaboratedDocsIds.map(async (docId: any) => {
      return {
        docId: docId,
        collaboratorIds: await GetUserIdsForDocWithRole(docId, "collaborator"),
        ownerIds: await GetUserIdsForDocWithRole(docId, "owner"),
        viewerIds: await GetUserIdsForDocWithRole(docId, "viewer")
      }
    })
    )
    let idsToUpdate = await Promise.all(userIds.map(async (user: any) => {
      return {
        docId: user.docId,
        userNames: await Promise.all([...user.collaboratorIds, ...user.ownerIds].map(async (eachuser: any) => {
          let userId = eachuser.split('/')[1]
          let userDetails: any = await userFindOne("id", userId, { firstName: 1, middleName: 1, lastName: 1, name: 1 })
          if (userDetails.firstName)
            return `${userDetails.firstName} ${userDetails.middleName || ""} ${userDetails.lastName || ""}`;
          else
            return userDetails.name
        })),
        userIds: [...user.collaboratorIds, ...user.ownerIds, ...user.viewerIds].map((eachuser: any) => {
          return eachuser.split('/')[1]
        })
      }
    }))
    let allDocs: any = await esClient.search({
      index: 'documents',
      body: {
        query: {
          "match_all": {}
        }
      }
    })

    let docIds = allDocs.hits.hits.map((doc: any) => { return doc._id })

    let updateUsers = await Promise.all(idsToUpdate.map(async (user: any) => {
      if (docIds.includes(user.docId)) {
        return await esClient.update({
          index: "documents",
          id: user.docId,
          body: {
            "script": {
              "source": "ctx._source.accessedBy=(params.userId);ctx._source.userName=(params.userNames)",
              "lang": "painless",
              "params": {
                "userId": user.userIds,
                "userNames": user.userNames
              }
            }
          }
        })
      }
    }))

    return { userIds, collaboratedDocsIds, idsToUpdate, updateUsers }

  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function updateTagsInDOcs(bodyObj: any, userId: string) {
  try {

    let allDocs: any = await esClient.search({
      index: 'documents',
      body: {
        query: {
          "match_all": {}
        }
      }
    })

    let docIds = allDocs.hits.hits.map((doc: any) => { return doc._id })

    let updateTags = await Promise.all(bodyObj.map(async (tag: any) => {
      if (docIds.includes(tag.docId)) {
        return await esClient.update({
          index: "documents",
          id: tag.docId,
          body: {
            "script": {
              "source": "ctx._source.tags=(params.tags)",
              "lang": "painless",
              "params": {
                "tags": tag.tags
              }
            }
          }
        })
      }
    }))

    return { updateTags }

  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function checkDocIdExistsInEs(docId:string){
  let checkDoc: any = await esClient.search({
    index: 'documents',
    body: {
      query: {
        "match": {id:docId}
      }
    }
  })
  if(checkDoc.hits.hits.length){
    return true
  }else{
    false
  }
}
