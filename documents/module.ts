import { documents } from "./model";
import { folders } from "./folder-model";
import * as http from "http";
import { Types, STATES, set, disconnect } from "mongoose";
import { userRoleAndScope } from "../role/module";
import { tags as Tags, tags } from "../tags/tag_model";
import { themes } from "../project/theme_model";
import { create as webNotification } from "../socket-notifications/module"
import { DOC_NOTIFICATIONS } from "../utils/web-notification-messages"
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
import { userFindOne, userFindMany, userList, listGroup, searchByname, groupFindOne, getNamePatternMatch, groupPatternMatch, userEdit, groupsFindMany } from "../utils/users";
import { checkRoleScope } from '../utils/role_management'
import { configLimit } from '../utils/systemconfig'
import { getTemplateBySubstitutions } from "../email-templates/module";
import { ANGULAR_URL } from "../utils/urls";
import { APIError } from "../utils/custom-error";
import { create } from "../log/module";
import { userCapabilities, getFullNameAndMobile, sendNotification, userDetails, groupList, formateRoles, changeGroupOwnerShip } from "../users/module";
import { docRequestModel } from "./document-request-model";
import { userRolesNotification } from "../notifications/module";
import { mobileSendMessage, getTasksForDocument } from "../utils/utils";
import { importExcelAndFormatData, add_tag, mapPhases, getCurrentPhase,backGroudJobForPhaseDocs } from "../project/module";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import request = require("request");
import { project as project_schema } from "../project/project_model";


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
const ELASTIC_SEARCH_INDEX = process.env.ELASTIC_SEARCH_INDEX
export async function createIndex(index: string) {
  return await esClient.indices.create({ index: index });

}

export async function removeIndex(index: string) {
  return await esClient.indices.delete({ index: index });

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
    // if (!/.*[A-Za-z0-9]{1}.*$/.test(body.docName)) throw new Error(DOCUMENT_ROUTER.NAME_ERROR)
    if (body.docName.length > Number(siteConstant.docNameLength || configLimit.name)) {
      throw new Error(DOCUMENT_ROUTER.DOCUMENT_NAME_LENGTH(siteConstant.docNameLength));
    }
    if (body.description.length > Number(siteConstant.docDescriptionSize || configLimit.description)) {
      throw new Error(DOCUMENT_ROUTER.DOCUMENT_DESCRIPTION_LENGTH(siteConstant.docDescriptionSize))
    }
    let data = await documents.find({ isDeleted: false, parentId: null, ownerId: userId, codeName: body.docName.toLowerCase() }).exec()
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
    await createActivityLog({ activityType: "DOCUMENT_CREATED", activityBy: userId, tagsAdded: body.tags || [], documentId: doc._id })
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
      createdAt: doc.createdAt,
      id: doc.id,
      groupId: [],
      groupName: [],
      createdBy: userId,
      projectName: [],
      city: [],
      reference: [],
      phases: []
    }
    let result =esClient.index({
      index: `${ELASTIC_SEARCH_INDEX}_documents`,
      body: docObj,
      id: doc.id
    });

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
    // if (body.name && (!/.*[A-Za-z0-9]{1}.*$/.test(body.name))) throw new Error("you have entered invalid name. please try again.")
    if (body.name.length > configLimit.name) { // added config
      throw new Error(DOCUMENT_ROUTER.LIMIT_EXCEEDED);
    }
    if (body.description.length > configLimit.description) { // added config
      throw new Error(DOCUMENT_ROUTER.LIMIT_EXCEEDED);
    }
    let doc = await insertDOC(body, userId);
    body.parentId = doc.id;
    let role = await groupsAddPolicy(`user/${userId}`, doc.id, "owner");
    if (!role.user) {
      await documents.findByIdAndRemove(doc.id);
      throw new Error(DOCUMENT_ROUTER.CREATE_ROLE_FAIL);
    }
    let response: any = await insertDOC(body, userId);
    await createActivityLog({ activityType: "DOCUMENT_CREATED", activityBy: userId, tagsAdded: body.tags || [], documentId: doc.id })
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
      codeName: body.docName || body.name,
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
      data = documentsSort(data, "name", false)
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
      owner: await userFindOne("id", docData.ownerId, { firstName: 1, middleName: 1, lastName: 1, email: 1, phone: 1, is_active: 1 }),
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

//  Get Fianancial Doc List
export async function getFinancialDocList(userId: string, page: number = 1, limit: number = 30, host: string) {
  try {
    let [isExist, docIds] = await Promise.all([
      checkRoleScope(((await userRoleAndScope(userId) as any).data || [""])[0], "view-all-cmp-documents"),
      getAllFinancialDocIds()
    ])
    let docs = await documents.find({ _id: { $in: docIds }, parentId: null, isDeleted: false, status: { $ne: STATUS.DRAFT } }).collation({ locale: 'en' }).sort({ name: 1 })
    const docList = await Promise.all(docs.map((doc) => {
      return docData(doc, host);
    }));
    let result = documentsSort(docList, "updatedAt", true)
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
    if (!versionID) throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID);
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
    if (!docDetails) throw new Error(DOCUMENT_ROUTER.DOCUMENTS_NOT_THERE);
    let createNewDoc: any = await documents.create({
      name: obj.name,
      codeName: obj.name,
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
    if (!docId || !versionId) throw new Error(DOCUMENT_ROUTER.MANDATORY);
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
    if (!versionId || !docId) throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID);
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
export async function getDocDetails(docId: any, userId: string, token: string, allCmp: boolean) {
  try {
    if (!Types.ObjectId.isValid(docId)) throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID);
    let publishDocs: any = await documents.findById(docId);
    const [allCmp, allFinancial] = await Promise.all([
      checkRoleScope(((await userRoleAndScope(userId) as any).data || [""])[0], "view-all-cmp-documents"),
      checkRoleScope(((await userRoleAndScope(userId) as any).data || [""])[0], "view-all-finanacial-documents")
    ]);
    if (!allCmp || !allFinancial) {
      if (publishDocs.isDeleted) throw new Error(DOCUMENT_ROUTER.DOCUMENT_DELETED(publishDocs.name))
      if (publishDocs.status != 2 && publishDocs.parentId == null) {
        let userCapability = await documnetCapabilities(publishDocs.parentId || publishDocs._id, userId)
        if (!userCapability.length) throw new Error(DOCUMENT_ROUTER.USER_HAVE_NO_ACCESS)
      }
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
    let [tagObjects, ownerRole, ownerObj, taskDetailsObj] = await Promise.all([
      getTags((docList.tags && docList.tags.length) ? docList.tags.filter((tag: string) => Types.ObjectId.isValid(tag)) : []),
      userRoleAndScope(docList.ownerId),
      userFindOne("id", docList.ownerId, { firstName: 1, lastName: 1, middleName: 1, email: 1, phone: 1, countryCode: 1, is_active: 1 }),
      getTasksForDocument(docList.parentId || docList._id, token),
    ])
    let projectIds = taskDetailsObj.filter(({ projectId }: any) => projectId).map(({ projectId }: any) => projectId)
    let projectDetails = await project_schema.find({ $or: [{ _id: { $in: projectIds || [] } }, { "funds.released.documents": { $in: [docId] } }, { "funds.utilized.documents": { $in: [docId] } }] }, { name: 1, city: 1, reference: 1, phases:1 }).exec()
    projectDetails = (await Promise.all(projectDetails.map(project => mapPhases(project)))).map(project =>({...project, phase: getCurrentPhase(project) || {}}))
    await createActivityLog({ activityType: `DOCUMENT_VIEWED`, activityBy: userId, documentId: docId })
    return {
      ...docList, tags: tagObjects,
      owner: { ...ownerObj, role: await formateRoles((ownerRole.data || [""])[0]) },
      taskDetails: taskDetailsObj, projectDetails,
      sourceId: docList.sourceId ? await documents.findById(docList.sourceId).exec() : ''
    }
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
    throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID);
  }
  const doc = await documents.findById(versionId);
  if (!doc) {
    throw new Error(DOCUMENT_ROUTER.DOCUMENTS_NOT_THERE);
  }
  return doc;
}

//  Get doc with Version
export async function getDocWithVersion(docId: any, versionId: any) {
  try {
    if (!docId || !versionId) throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID);
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

export async function updateDoc(objBody: any, docId: any, userId: string,host:string,token:string) {
  try {
    if (!Types.ObjectId.isValid(docId))
      throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID);
    let capability = await GetDocCapabilitiesForUser(userId, docId);
    if (capability.includes("viewer"))
      throw new Error(DOCUMENT_ROUTER.INVALID_UPDATE_USER);
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
      codeName: parent.name,
      description: parent.description,
      tags: parent.tags,
      versionNum: Number(child[0].versionNum) + 1,
      status: parent.status,
      ownerId: userId,
      parentId: parent.id,
      fileId: parent.fileId,
      fileName: parent.fileName
    })
    // let isDocExists = await checkDocIdExistsInEs(docId)
    // if (isDocExists) {
    //   let tags: any = await getTags(parent.tags.filter((tag: string) => Types.ObjectId.isValid(tag)))
    //   let tagNames = tags.map((tag: any) => { return tag.tag })
    //   let updatedData = esClient.update({
    //     index: `${ELASTIC_SEARCH_INDEX}_documents`,
    //     id: docId,
    //     body: {
    //       "script": {
    //         "source": "ctx._source.tags=(params.tags);ctx._source.name=(params.name);ctx._source.description=(params.description);ctx._source.fileName=(params.fileName);",
    //         "lang": "painless",
    //         "params": {
    //           "tags": tagNames,
    //           "name": parent.name,
    //           "description": parent.description,
    //           "fileName": parent.fileName
    //         }
    //       }
    //     }
    //   })
    // }
    updateOrCreateDocInElasticSearch(docId,host,token)
    return parent;
  } catch (err) {
    console.error(err);
    throw err;
  };
};

export async function cancelUpdate(docId: string, userId: string) {
  try {
    await createActivityLog({ activityType: `CANCEL_UPDATED`, activityBy: userId, documentId: docId })
    return { success: true }
  } catch (err) {
    throw err;
  };
};

export async function updateDocNew(objBody: any, docId: any, userId: string, siteConstants: any,host: string, token: string) {
  try {
    let userRoles = await userRoleAndScope(userId);
    let userRole = userRoles.data[0];
    // const isEligible = await checkRoleScope(userRole, "edit-document");
    // if (!isEligible) {
    //   throw new APIError(DOCUMENT_ROUTER.NO_PERMISSION, 403);
    // }
    if (!Types.ObjectId.isValid(docId)) throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID);
    let capability = await documnetCapabilities(docId, userId);
    if (capability.includes("viewer")) throw new Error(DOCUMENT_ROUTER.INVALID_UPDATE_USER);
    let obj: any = {};
    if (objBody.docName) {
      // if (!/.*[A-Za-z0-9]{1}.*$/.test(objBody.docName)) throw new Error(DOCUMENT_ROUTER.NAME_ERROR)
      if (objBody.docName.length > Number(siteConstants.docNameLength || configLimit.name)) throw new Error(DOCUMENT_ROUTER.DOCUMENT_NAME_LENGTH(siteConstants.docNameLength));
      let data = await documents.findOne({ _id: { $ne: docId }, isDeleted: false, parentId: null, ownerId: userId, codeName: objBody.docName.toLowerCase() }).exec()
      if (data) {
        throw new Error(DOCUMENT_ROUTER.DOC_ALREADY_EXIST);
      }
      obj.name = objBody.docName;
      obj.codeName = objBody.docName.toLowerCase();
    }
    if (objBody.description || objBody.description == "") {
      if (objBody.description.length > Number(siteConstants.docDescriptionSize || configLimit.description)) throw new Error(DOCUMENT_ROUTER.DOCUMENT_DESCRIPTION_LENGTH(siteConstants.docDescriptionSize))
      obj.description = objBody.description;
    }

    objBody.tags = (Array.isArray(objBody.tags) ? objBody.tags : typeof (objBody.tags) == "string" && objBody.tags.length ? objBody.tags.includes("[") ? JSON.parse(objBody.tags) : objBody.tags = objBody.tags.split(',') : []).filter((tag: any) => Types.ObjectId.isValid(tag))

    let _document: any = await documents.findById(docId)
    if (objBody.tags && !objBody.docName && !objBody.description) {
      let userRoles = await userRoleAndScope(userId);
      let userRole = userRoles.data[0];
      const isEligible = _document.status == 2 ? await checkRoleScope(userRole, "add-tags-publish") : await checkRoleScope(userRole, "add-tag-to-document")
      if (!isEligible) {
        throw new APIError(DOCUMENT_ROUTER.NO_TAGS_PERMISSION, 403);
      }
      let userCapabilities = await GetDocCapabilitiesForUser(userId, docId)
      if (!userCapabilities.includes("owner") && _document.status != 2) throw new Error(DOCUMENT_ROUTER.INVALID_ACTION_PERFORMED)
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
        codeName: parent.name,
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
      const message = `${_document.name != parent.name ? "name" : ""}${(_document.description != null && _document.description != parent.description) ? _document.name != parent.name ? (_document.fileId != parent.fileId ? ", description" : " and description") : "description" : ""}${_document.fileId != parent.fileId ? (_document.description != null && _document.description != parent.description) ? " and file" : _document.name != parent.name ? " and file" : "file" : ""}`
      mailAllCmpUsers("documentUpdate", parent, false, userId, message)
      await createActivityLog({ activityType: `DOCUMENT_UPDATED`, activityBy: userId, documentId: docId, message })
    } else {
      await documents.findByIdAndUpdate(child[child.length - 1]._id, { tags: parent.tags, suggestedTags: parent.suggestedTags })
      let addtags = obj.tags.filter((tag: string) => !child[child.length - 1].tags.includes(tag))
      let removedtags = child[child.length - 1].tags.filter((tag: string) => !obj.tags.includes(tag))
      await approveTagsAuto(docId,addtags,removedtags);
      if (addtags.length && removedtags.length) {
        let tagObjs = await Tags.find({ "_id": { $in: [...addtags, ...removedtags] } })
        let addTagNames = tagObjs.filter(({ _id }) => addtags.includes(_id)).map(({ tag }: any) => tag).join(",")
        let removedTagNames = tagObjs.filter(({ _id }) => addtags.includes(_id)).map(({ tag }: any) => tag).join(",")
        const addMessage = addTagNames.lastIndexOf(",") == -1 ? `${addTagNames} tag added` : `${addTagNames.slice(0, addTagNames.lastIndexOf(",")) + " and " + addTagNames.slice(addTagNames.lastIndexOf(",") + 1)} tags added`
        const removedMessage = removedTagNames.lastIndexOf(",") == -1 ? `${removedTagNames} tag removed` : `${removedTagNames.slice(0, removedTagNames.lastIndexOf(",")) + " and " + removedTagNames.slice(removedTagNames.lastIndexOf(",") + 1)} tags removed`
        const message = addMessage + "and" + removedMessage;
        mailAllCmpUsers("documentUpdate", parent, false, userId, message)
        await createActivityLog({ activityType: `TAGS_ADD_AND_REMOVED`, activityBy: userId, documentId: docId, tagsAdded: addtags, tagsRemoved: removedtags })
      } else {
        if (addtags.length) {
          let tags = ((await Tags.find({ "_id": { $in: addtags } })).map(({ tag }: any) => tag)).join(",")
          // const message = tags.lastIndexOf(",") == -1 ? `${tags} tag` : `${tags.slice(0, tags.lastIndexOf(",")) + " and " + tags.slice(tags.lastIndexOf(",") + 1)} tags`
          const message = `tag`
          mailAllCmpUsers("documentUpdate", parent, false, userId, message)
          await createActivityLog({ activityType: `TAGS_ADDED`, activityBy: userId, documentId: docId, tagsAdded: addtags })
        }
        if (removedtags.length) {
          let tags = ((await Tags.find({ "_id": { $in: removedtags } })).map(({ tag }: any) => tag)).join(",")
          const message = tags.lastIndexOf(",") == -1 ? `${tags} tag` : `${tags.slice(0, tags.lastIndexOf(",")) + " and " + tags.slice(tags.lastIndexOf(",") + 1)} tags`
          // mailAllCmpUsers("documentUpdate", parent, false, userId, message)
          await createActivityLog({ activityType: `TAGS_REMOVED`, activityBy: userId, documentId: docId, tagsRemoved: removedtags })
        }
      }
    }
    // let isDocExists = await checkDocIdExistsInEs(docId)
    // if (isDocExists) {
    //   let tags: any = await getTags(parent.tags.filter((tag: string) => Types.ObjectId.isValid(tag)))
    //   let tagNames = tags.map((tag: any) => { return tag.tag })
    //   let updatedData = esClient.update({
    //     index: `${ELASTIC_SEARCH_INDEX}_documents`,
    //     id: docId,
    //     body: {
    //       "script": {
    //         "source": "ctx._source.tags=(params.tags);ctx._source.name=(params.name);ctx._source.description=(params.description);ctx._source.fileName=(params.fileName);",
    //         "lang": "painless",
    //         "params": {
    //           "tags": tagNames,
    //           "name": parent.name,
    //           "description": parent.description,
    //           "fileName": parent.fileName
    //         }
    //       }
    //     }
    //   })
    // }
    updateOrCreateDocInElasticSearch(docId,host,token)
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
      throw new Error(DOCUMENT_ROUTER.MISSING_COLLABORATOR);
    await Promise.all([
      collaborators.map(async (user: string) => {
        let success = await groupsAddPolicy(user, docId, "collaborator");
        if (!success.user)
          throw new Error(DOCUMENT_ROUTER.USER_ALREADY_THIS_PERMISSION(user));
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
    if (!Types.ObjectId.isValid(docId)) throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID);
    if (!Array.isArray(collaborators))
      throw new Error(DOCUMENT_ROUTER.MISSING_COLLABORATOR);
    await Promise.all([
      collaborators.map(async (user: string) => {
        let success = await groupsRemovePolicy(user, docId, "collaborator");
        if (!success.user)
          throw new Error(DOCUMENT_ROUTER.USER_ALREADY_THIS_PERMISSION(user));
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
    if (!Types.ObjectId.isValid(docId)) throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID);
    if (!Array.isArray(viewers)) throw new Error(DOCUMENT_ROUTER.INVALID_OR_MISSING_DATA);
    await Promise.all([
      viewers.map(async (user: string) => {
        let success = await groupsAddPolicy(user, docId, "viewer");
        if (!success.user)
          throw new Error(DOCUMENT_ROUTER.USER_ALREADY_THIS_PERMISSION(user));
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
    if (!Types.ObjectId.isValid(docId)) throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID);
    if (!Array.isArray(viewers)) throw new Error(DOCUMENT_ROUTER.INVALID_OR_MISSING_DATA);
    await Promise.all([
      viewers.map(async (user: string) => {
        let success = await groupsRemovePolicy(user, docId, "viewer");
        if (!success.user)
          throw new Error(DOCUMENT_ROUTER.USER_ALREADY_THIS_PERMISSION(user));
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
    return await userList({ _id: { $in: users } }, { firstName: 1, middleName: 1, lastName: 1, email: 1, phone: 1, countryCode: 1, is_active: 1 });
  } catch (err) {
    throw err;
  }
}

export async function viewerList(docId: string) {
  try {
    let users = await GetUserIdsForDocWithRole(docId, "viewer");
    return await userList({ _id: { $in: users } }, { firstName: 1, middleName: 1, lastName: 1, email: 1, phone: 1, is_active: 1 });
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
      data = documentsSort(data, "name", false)
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
    const [allCmp, allFinancial, allFinancialDocIds] = await Promise.all([
      checkRoleScope(((await userRoleAndScope(userId) as any).data || [[]])[0], "view-all-cmp-documents"),
      checkRoleScope(((await userRoleAndScope(userId) as any).data || [[]])[0], "view-all-finanacial-documents"),
      getAllFinancialDocIds()
    ])
    if (allCmp) return request ? ["viewer", "all_cmp", true] : ["viewer", "all_cmp"]
    if (allFinancial && allFinancialDocIds.includes(docId)) return request ? ["viewer", "all_financial", true] : ["viewer", "all_financial"]
    return request ? ["no_access", true] : ["no_access"]
  } catch (err) {
    throw err;
  };
};

async function getAllFinancialDocIds() {
  let all_projects: any = await project_schema.find({}, { funds: 1 }).exec();
  return all_projects.reduce((main: string[], curr: any) => {
    return main.concat((curr.funds && curr.funds.length) ? (curr.toJSON()).funds.map((fundObj: any) => {
      if (fundObj.released && fundObj.released.documents && fundObj.released.documents.length) return fundObj.released.documents
      if (fundObj.utilized && fundObj.utilized.documents && fundObj.utilized.documents.length) return fundObj.utilized.documents
      return []
    }).reduce((main: any[], curr: any) => main.concat(curr), []) : [])
  }, []).filter((id: string) => Types.ObjectId(id))
}

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

async function invite(user: any, docId: any, role: any, doc: any, actionUserId: string) {
  await shareDoc(user._id, user.type, docId, role);
  if (user.type == "user") {
    inviteMail(user._id, doc, actionUserId)
  } else if (user.type == "group") {
    let userIds = await groupUserList(user._id)
    userIds = userIds.filter(userId => userIds != doc.ownerId)
    await Promise.all(userIds.map(userId => inviteMail(userId, doc, actionUserId)))
  }
};

async function inviteMail(userId: string, doc: any, actionUserId: string) {
  try {
    let userData: any = await userFindOne("id", userId);
    let userName = `${userData.firstName} ${userData.middleName || ""} ${userData.lastName || ""}`;
    const { fullName, mobileNo } = getFullNameAndMobile(userData);
    webNotification({ notificationType: `DOCUMENTS`, userId: userData._id, docId: doc._id, title: DOC_NOTIFICATIONS.inviteForDocument(doc.name), from: actionUserId })
    sendNotification({ id: userData._id, fullName, mobileNo, email: userData.email, documentName: doc.name, documentUrl: `${ANGULAR_URL}/home/resources/doc/${doc._id}`, templateName: "inviteForDocument", mobileTemplateName: "inviteForDocument" });
  } catch (err) {
    throw err;
  };
};

export async function invitePeople(docId: string, users: any, role: string, userId: string,host: string,token:string) {
  try {
    let userRoles = await userRoleAndScope(userId);
    let getUserRole = userRoles.data[0];
    // const isEligible = await checkRoleScope(getUserRole, "share-document");
    // if (!isEligible) {
    //   throw new APIError(DOCUMENT_ROUTER.NO_PERMISSION, 403);
    // }
    if (!docId || !Array.isArray(users) || !users.length || !role) throw new Error(DOCUMENT_ROUTER.INVALID_OR_MISSING_DATA);
    let doc: any = await documents.findById(docId);
    if (doc.status == 2) throw new Error(DOCUMENT_ROUTER.SHARE_PUBLISHED_DOCUMENT)
    let userRole = await documnetCapabilities(docId, userId)
    if (userRole.includes("collaborator") && role != "viewer") throw new Error(DOCUMENT_ROUTER.INVALID_COLLABORATOR_ACTION)
    if (userRole.includes("viewer") || userRole.includes("no_access")) throw new Error(DOCUMENT_ROUTER.INVALID_VIEWER_ACTION)
    let addUsers: any = []
    let userIds: any = []
    let userNames: any = []
    let groupIds: any = []
    let groupNames: any = []
    
    await Promise.all(
      users.map(async (user: any) => {
        if (doc.ownerId != user._id) {
          addUsers.push({ id: user._id, type: user.type, role: role })
          if (user.type == 'user') {
            userIds.push(user._id);
            let request = await docRequestModel.findOne({ docId, requestedBy: user._id, isDelete: false })
            if (request && role == "collaborator") {
              await docRequestModel.findByIdAndUpdate(request.id, { $set: { isDelete: true } }, {})
            }
          }
          else if (user.type == 'group') {
            groupIds.push(user._id);
            let groupName: any = await groupFindOne('_id', user._id);
            groupNames.push(groupName.name);
            let groupUserIds = await groupUserList(user._id)
            groupUserIds = groupUserIds.filter(userId => userId != doc.ownerId)
            userIds.push(...groupUserIds)
            let requestList:any = await docRequestModel.find({ docId, requestedBy: { $in: groupUserIds} , isDelete: false })
            if(requestList && requestList.length && role == "collaborator"){
               let requestDocs = await Promise.all(requestList.map(async(request:any)=>{
                await docRequestModel.findByIdAndUpdate(request.id, { $set: { isDelete: true } }, {})
               }))
            }
          }
          return await invite(user, docId, role, doc, userId)
        }
      })
    );
    await Promise.all(
      userIds.map(async (user: any) => {
        let userDetails: any = await userFindOne("id", user, { firstName: 1, middleName: 1, lastName: 1, email: 1, phone: 1, countryCode: 1, is_active: 1 })
        userNames.push(`${userDetails.firstName} ${userDetails.middleName || ""} ${userDetails.lastName || ""}`)
      })
    );
    // let isDocExists = await checkDocIdExistsInEs(docId)
    // if (isDocExists) {
    //   if (groupIds.length && groupNames.length) {
    //     let update = esClient.update({
    //       index: `${ELASTIC_SEARCH_INDEX}_documents`,
    //       id: docId,
    //       body: {
    //         "script": {
    //           "source": "ctx._source.accessedBy.addAll(params.userId);ctx._source.userName.addAll(params.userNames);ctx._source.groupId.addAll(params.groupId);ctx._source.groupName.addAll(params.groupName)",
    //           "lang": "painless",
    //           "params": {
    //             "userId": userIds,
    //             "userNames": userNames,
    //             "groupId": groupIds,
    //             "groupName": groupNames
    //           }
    //         }
    //       }
    //     })
    //   } else {
    //     let updatedData = esClient.update({
    //       index: `${ELASTIC_SEARCH_INDEX}_documents`,
    //       id: docId,
    //       body: {
    //         "script": {
    //           "source": "ctx._source.accessedBy.addAll(params.userId);ctx._source.userName.addAll(params.userNames)",
    //           "lang": "painless",
    //           "params": {
    //             "userId": userIds,
    //             "userNames": userNames,
    //           }
    //         }
    //       }
    //     })
    //   }
    // }

    await createActivityLog({ activityType: `DOCUMENT_SHARED_AS_${role}`.toUpperCase(), activityBy: userId, documentId: docId, documentAddedUsers: addUsers })
    mailAllCmpUsers("invitePeopleDoc", doc, false, userId, addUsers)
    updateOrCreateDocInElasticSearch(docId,host,token)
    return { message: "Shared successfully." };
  } catch (err) {
    throw err;
  }
}

export async function invitePeopleEdit(docId: string, userId: string, type: string, role: string, userObj: any) {
  try {
    let userRoles = await userRoleAndScope(userId);
    let getUserRole = userRoles.data[0];
    // const isEligible = await checkRoleScope(getUserRole, "share-document");
    // if (!isEligible) {
    //   throw new APIError(DOCUMENT_ROUTER.NO_PERMISSION, 403);
    // }
    if (!docId || !userId || !type || !role) throw new Error(DOCUMENT_ROUTER.MANDATORY);
    let actionUserRole = await documnetCapabilities(docId, userObj._id)
    if (actionUserRole.includes("collaborator") && role != "viewer") throw new Error(DOCUMENT_ROUTER.INVALID_COLLABORATOR_ACTION)
    if (actionUserRole.includes("viewer") || actionUserRole.includes("no_access")) throw new Error(DOCUMENT_ROUTER.INVALID_VIEWER_ACTION)
    let userRole: any = await getRoleOfDoc(userId, docId, type);
    if (userRole && userRole.length) {
      await groupsRemovePolicy(`${type}/${userId}`, docId, userRole[2]);
    }
    let request = await docRequestModel.findOne({ docId, requestedBy: userId, isDelete: false })
    if (request && role == "collaborator") {
      await docRequestModel.findByIdAndUpdate(request.id, { $set: { isDelete: true } }, {})
    }
    if(type == 'group' && role == "collaborator"){
      let groupData: any = await groupFindOne('_id', userId);
      let groupUserIds = await groupUserList(userId);
      let requestList:any = await docRequestModel.find({ docId, requestedBy: { $in: groupUserIds} , isDelete: false })
      if(requestList && requestList.length){
         let requestDocs = await Promise.all(requestList.map(async(request:any)=>{
          await docRequestModel.findByIdAndUpdate(request.id, { $set: { isDelete: true } }, {})
         }))
      }
    }
    await groupsAddPolicy(`${type}/${userId}`, docId, role);
    await createActivityLog({ activityType: `MODIFIED_${type}_SHARED_AS_${role}`.toUpperCase(), activityBy: userObj._id, documentId: docId, documentAddedUsers: [{ id: userId, type: type, role: role }] })
    // mailAllCmpUsers("invitePeopleEditDoc", await documents.findById(docId), false, [{ id: userId, type: type, role: role }])
    return { message: "Edit user successfully." };
  } catch (err) {
    throw err;
  }
}

export async function invitePeopleRemove(docId: string, userId: string, type: string, role: string, userObj: any,host: string,token:string) {
  try {
    let userRoles = await userRoleAndScope(userId);
    let getUserRole = userRoles.data[0];
    // const isEligible = await checkRoleScope(getUserRole, "share-document");
    // if (!isEligible) {
    //   throw new APIError(DOCUMENT_ROUTER.NO_PERMISSION, 403);
    // }
    if (!docId || !userId || !type || !role) throw new Error(DOCUMENT_ROUTER.MANDATORY);
    let userRole = await documnetCapabilities(docId, userObj._id)
    if (!userRole.includes("owner")) throw new Error(DOCUMENT_ROUTER.INVALID_ACTION_TO_REMOVE_SHARE_CAPABILITY)
    await groupsRemovePolicy(`${type}/${userId}`, docId, role);
    await createActivityLog({ activityType: `REMOVED_${type}_FROM_DOCUMENT`.toUpperCase(), activityBy: userObj._id, documentId: docId, documentRemovedUsers: [{ id: userId, type: type, role: role }] })
    // mailAllCmpUsers("invitePeopleRemoveDoc", await documents.findById(docId), false, [{ id: userId, type: type, role: role }])
    // if (type == 'user') {
    //   let userDetails: any = await userFindOne("id", userId, { firstName: 1, middleName: 1, lastName: 1, email: 1, phone: 1, countryCode: 1, is_active: 1 })
    //   let userName = (`${userDetails.firstName} ${userDetails.middleName || ""} ${userDetails.lastName || ""}`)
    //   let isDocExists = await checkDocIdExistsInEs(docId)
    //   if (isDocExists) {
    //     let updatedData = esClient.update({
    //       index: `${ELASTIC_SEARCH_INDEX}_documents`,
    //       id: docId,
    //       body: {
    //         "script": {
    //           "inline": "ctx._source.accessedBy.remove(ctx._source.accessedBy.indexOf(params.accessedBy));ctx._source.userName.remove(ctx._source.userName.indexOf(params.userName))",
    //           "lang": "painless",
    //           "params": {
    //             "accessedBy": userId,
    //             "userName": userName
    //           }
    //         }
    //       }
    //     })
    //   }
    // }
    // if (type == 'group') {
    //   let groupData: any = await groupFindOne('_id', userId);
    //   let groupName = groupData.name;
    //   let groupUserIds = await groupUserList(userId);
    //   let idsToUpdate = await Promise.all(groupUserIds.map(async (id: any) => {
    //     let userDetails: any = await userFindOne("id", id, { firstName: 1, middleName: 1, lastName: 1, name: 1 })
    //     if (userDetails) {
    //       if (userDetails.firstName)
    //         userDetails = `${userDetails.firstName} ${userDetails.middleName || ""} ${userDetails.lastName || ""}`;
    //       else
    //         userDetails = userDetails.name
    //     }
    //     return {
    //       docId: docId,
    //       userName: userDetails,
    //       userId: id,
    //       groupId: userId,
    //       groupName: groupName
    //     }
    //   }))
    //   let isDocExists = await checkDocIdExistsInEs(docId)
    //   if (isDocExists) {

    //       await  esClient.update({
    //         index: `${ELASTIC_SEARCH_INDEX}_documents`,
    //         id: docId,
    //         body: {
    //           "script": {
    //             "inline": "ctx._source.groupName.remove(ctx._source.groupName.indexOf(params.groupName));ctx._source.groupId.remove(ctx._source.groupId.indexOf(params.groupId));",
    //             "lang": "painless",
    //             "params": {
    //               "groupName": groupName,
    //               "groupId": userId
    //             }
    //           }
    //         }
    //       })
        
    //     let updateUsers = await Promise.all(idsToUpdate.map(async (user: any) => {
    //       await  esClient.update({
    //         index: `${ELASTIC_SEARCH_INDEX}_documents`,
    //         id: user.docId,
    //         body: {
    //           "script": {
    //             "inline": "ctx._source.accessedBy.remove(ctx._source.accessedBy.indexOf(params.userId));ctx._source.userName.remove(ctx._source.userName.indexOf(params.userName));",
    //             "lang": "painless",
    //             "params": {
    //               "userId": user.userId,
    //               "userName": user.userName,
    //             }
    //           }
    //         }
    //       })
    //     }))
    //   }
    // }
    updateOrCreateDocInElasticSearch(docId,host,token)
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
    (users || []).map((user: any) => {
      if (userGroup[user.split("/")[0]]) {
        userGroup[user.split("/")[0]].push(user.split("/")[1]);
      } else {
        userGroup[user.split("/")[0]] = [user.split("/")[1]];
      }
    });
    if (userGroup.user) {
      var userData: any = await userList(
        { _id: { $in: userGroup.user }, is_active: true },
        { firstName: 1, middleName: 1, lastName: 1, email: 1, phone: 1, is_active: 1, countryCode: 1 }
      );
      userData = await Promise.all(
        userData.map(async (user: any) => {
          return {
            is_active: user.is_active,
            phone: user.phone,
            countryCode: user.countryCode,
            id: user._id,
            firstName: user.firstName,
            middleName: user.middleName,
            lastName: user.lastName,
            type: "user",
            email: user.email,
            role: await formateRoles(((await userRoleAndScope(user._id) as any).data || [""])[0]),
            docRole: ((await getRoleOfDoc(user._id, docId) as any) || Array(2))[2]
          };
        })
      );
      total = [...userData];
    }
    if (userGroup.group) {
      var groupData: any = await listGroup(
        { _id: { $in: userGroup.group } },
        { name: 1 }
      );
      groupData = await Promise.all(groupData.map((group: any) => groupUsers(group, docId)));
      total = !total.length ? [...groupData] : total.concat(groupData);
    }
    return total;
  } catch (err) {
    throw err;
  }
}

async function groupUsers(groupObj: any, docId?: string) {
  try {
    let userId = await groupUserList(groupObj._id) || [];
    return {
      ...groupObj,
      id: groupObj._id,
      name: groupObj.name,
      type: "group",
      email: "N/A",
      members: (await userFindMany("_id", userId, { firstName: 1, middleName: 1, lastName: 1, email: 1, phone: 1, is_active: 1 }) || []).map((obj: any) => { return { ...obj, type: "user" } }),
      docRole: docId ? (((await getRoleOfDoc(groupObj._id, docId, "group")) as any) || Array(2))[2] : "",
    }
  } catch (err) {
    throw err
  };
};

export async function docCapabilities(docId: string, userId: string) {
  try {
    return await GetDocCapabilitiesForUser(userId, docId);
  } catch (err) {
    throw err;
  }
}

export async function published(body: any, docId: string, userObj: any, host: string,token:string, withAuth: boolean = true ) {
  try {
    if (!Types.ObjectId.isValid(docId)) throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID)
    if (withAuth) {
      let admin_scope = await checkRoleScope(userObj.role, "publish-document");
      if (!admin_scope) throw new APIError(DOCUMENT_ROUTER.PUBLISH_CAPABILITY, 403);
    };

    let doc: any = await documents.findById(docId);
    if (!doc) throw new Error(DOCUMENT_ROUTER.DOCUMENTS_NOT_THERE);

    if (body.tags && Array.isArray(body.tags) && (body.tags.some((tagId: string) => !doc.tags.includes(tagId)) || body.tags.length != doc.tags.length)) {
      let isEligible = await checkRoleScope(userObj.role, "add-tag-to-document");
      if (!isEligible) {
        throw new APIError(DOCUMENT_ROUTER.NO_PERMISSION_TO_UPDATE_TAGS, 403);
      }
    }
    let publishedDoc = await publishedDocCreate({ ...body, status: STATUS.PUBLISHED }, userObj._id, doc, host, docId)
    await Promise.all([
      createActivityLog({ activityType: `DOUCMENT_PUBLISHED`, activityBy: userObj._id, documentId: publishedDoc._id, fromPublished: docId }),
      createActivityLog({ activityType: `DOUCMENT_PUBLISHED`, activityBy: userObj._id, documentId: docId, fromPublished: docId })
    ])
    let role = await groupsAddPolicy(`user/${userObj._id}`, publishedDoc._id, "owner");
    if (!role.user) {
      await documents.findByIdAndRemove(publishedDoc._id);
      throw new Error(DOCUMENT_ROUTER.CREATE_ROLE_FAIL);
    }
    let publishedChild = await publishedDocCreate({ ...body, parentId: publishedDoc._id, status: STATUS.DONE }, userObj._id, doc, host,token)
    if (withAuth) mailAllCmpUsers("publishDocument", publishedDoc, true, userObj._id)
    return publishedDoc
  } catch (err) {
    throw err;
  };
};

async function publishedDocCreate(body: any, userId: string, doc: any, host: string, token:string, docId?: string) {
  try {
    let createdDoc: any = await documents.create({
      sourceId: docId || null,
      name: body.name || doc.name,
      codeName: body.name || doc.name,
      description: body.description || doc.description,
      themes: body.themes || doc.theme,
      tags: body.tags || doc.tags,
      versionNum: 1,
      status: body.status,
      ownerId: userId,
      parentId: body.parentId ? body.parentId : null,
      fileName: body.fileName || doc.fileName,
      fileId: body.fileId || doc.fileId
    });
    // if (!body.parentId) {
    //   let userDetails: any = await userFindOne("id", userId, { firstName: 1, middleName: 1, lastName: 1, name: 1 })
    //   let userName;
    //   if (userDetails.firstName)
    //     userName = `${userDetails.firstName} ${userDetails.middleName || ""} ${userDetails.lastName || ""}`;
    //   else {
    //     userName = userDetails.name
    //   }
    //   let fileType = createdDoc.fileName ? (createdDoc.fileName.split(".")).pop() : ""

    //   let thumbnail = (fileType == "jpg" || fileType == "jpeg" || fileType == "png") ? `${host}/api/docs/get-document/${createdDoc.fileId}` : "N/A"

    //   let tags = await getTags((createdDoc.tags && createdDoc.tags.length) ? createdDoc.tags.filter((tag: string) => Types.ObjectId.isValid(tag)) : [])
    //   tags = tags.map((tagData: any) => { return tagData.tag })
    //   let docObj = {
    //     accessedBy: [userId],
    //     userName: [userName],
    //     name: createdDoc.name,
    //     description: createdDoc.description,
    //     tags: tags,
    //     thumbnail: thumbnail,
    //     status: createdDoc.status,
    //     fileName: createdDoc.fileName,
    //     updatedAt: createdDoc.updatedAt,
    //     id: createdDoc.id || createdDoc._id,
    //     groupId: [],
    //     groupName: []
    //   }
    //   let result = esClient.index({
    //     index: `${ELASTIC_SEARCH_INDEX}_documents`,
    //     body: docObj,
    //     id: createdDoc.id || createdDoc._id
    //   });
    // }
    updateOrCreateDocInElasticSearch(createdDoc.id || createdDoc._id,host,token)
    return createdDoc;

  } catch (err) {
    throw err
  }
}


export async function unPublished(docId: string, userObj: any,host: string,token:string) {
  try {
    if (!Types.ObjectId.isValid(docId)) throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID)
    let [isEligible, docDetail] = await Promise.all([
      checkRoleScope(userObj.role, "unpublish-document"),
      documents.findById(docId).exec()
    ])
    if (!isEligible) throw new APIError(DOCUMENT_ROUTER.UNAUTHORIZED, 403);
    if ((docDetail as any).isPublic) {
      throw new APIError(DOCUMENT_ROUTER.UNPUBLISH_PUBLIC_DOCUMENT)
    }
    let success = await documents.findByIdAndUpdate(docId, { status: STATUS.UNPUBLISHED }, { new: true });
    await createActivityLog({ activityType: `DOUCMENT_UNPUBLISHED`, activityBy: userObj._id, documentId: docId });
    // let isDocExists = await checkDocIdExistsInEs(docId)
    // if (isDocExists) {
    //   let updatedData = esClient.update({
    //     index: `${ELASTIC_SEARCH_INDEX}_documents`,
    //     id: docId,
    //     body: {
    //       "script": {
    //         "source": "ctx._source.status=(params.status)",
    //         "lang": "painless",
    //         "params": {
    //           "status": STATUS.UNPUBLISHED,
    //         }
    //       }
    //     }
    //   })
    // }
    mailAllCmpUsers("unPublishDocument", success, true, userObj._id)
    updateOrCreateDocInElasticSearch(docId,host,token)
    return success
  } catch (err) {
    throw err;
  };
};

export async function replaceDoc(docId: string, replaceDoc: string, userObj: any, siteConstants: any, payload: any, host: string,token:string) {
  try {
    if (siteConstants.replaceDoc == "true") {
      let admin_scope = await checkRoleScope(userObj.role, "replace-document");
      if (!admin_scope) throw new APIError(DOCUMENT_ROUTER.UNAUTHORIZED, 403);
      let [doc, unPublished]: any = await Promise.all([documents.findById(replaceDoc).exec(),
      documents.findByIdAndUpdate(docId, { status: STATUS.UNPUBLISHED }, { new: true }).exec()]);
      let success = await published({ ...doc, name: payload.name || doc.name, description: payload.description || doc.description, versionNum: 1, status: STATUS.PUBLISHED, ownerId: userObj._id }, doc._id, userObj, host,token, false)
      await createActivityLog({ activityType: `DOUCMENT_REPLACED`, activityBy: userObj._id, documentId: docId, replaceDoc: success._id })
      mailAllCmpUsers("replaceDocument", success, true, userObj._id)
      // let isDocExists =await checkDocIdExistsInEs(docId)
      // if (isDocExists) {
      //   let updatedData = await esClient.update({
      //     index: `${ELASTIC_SEARCH_INDEX}_documents`,
      //     id: docId,
      //     body: {
      //       "script": {
      //         "source": "ctx._source.status=(params.status)",
      //         "lang": "painless",
      //         "params": {
      //           "status": STATUS.UNPUBLISHED,
      //         }
      //       }
      //     }
      //   })
      // }
      updateOrCreateDocInElasticSearch(docId,host,token)
      return success
    }
    else {
      throw new APIError(DOCUMENT_ROUTER.UNAUTHORIZED, 403)
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
    let users: any = await getNamePatternMatch(search, { name: 1, firstName: 1, lastName: 1, middleName: 1, email: 1, emailVerified: 1, is_active: 1, phone: 1, countryCode: 1 })
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

export async function getFolderDetails(folderId: string, userId: any, page: number = 1, limit: number = 30, host: string, root: any) {
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
  // let rootPath:any = [];
  let checkFolderData: any = await folders.findById(folderId);
  // let checkParent = false
  let rootPath: any = [];
  if (checkFolderData.parentId) {
    let path: any = await getParentFolderDetails(checkFolderData.parentId, userId, root)
    path = path.reverse();
    rootPath.push(...path);
  }
  rootPath.push({ id: checkFolderData._id, name: checkFolderData.name })
  return { page: docsData.page, pages: docsData.pages, folderName: folderName.name, subFoldersList: filteredSubFolders, docsList: docsData.docs, path: rootPath };
}

async function getParentFolderDetails(parentId: string, userId: string, root: any) {

  let parentData: any = await folders.findById(parentId);
  root.push({ id: parentData._id, name: parentData.name })
  if (parentData.parentId) {
    await getParentFolderDetails(parentData.parentId, userId, root);
  }
  return root;
}

async function userData(folder: any, host: string) {
  try {
    let fileType = folder.doc_id.fileName ? (folder.doc_id.fileName.split(".")).pop() : ""
    const [tags, userRole, owner] = await Promise.all([
      // getTags(folder.doc_id.tags),
      getTags((folder.doc_id.tags && folder.doc_id.tags.length) ? folder.doc_id.tags.filter((tag: string) => Types.ObjectId.isValid(tag)) : []),
      userRoleAndScope(folder.doc_id.ownerId),
      userFindOne("id", folder.doc_id.ownerId, { firstName: 1, middleName: 1, lastName: 1, email: 1, phone: 1, countryCode: 1, is_active: 1 })
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
      createdAt: folder.doc_id.createdAt,
      updatedAt: folder.doc_id.updatedAt,
      isDeleted: folder.doc_id.isDeleted
    }])
    return data

  } catch (err) {
    throw err;
  }
}

export async function deleteFolder(folderId: string, userId: string) {
  try {
    let userRoles = await userRoleAndScope(userId);
    let userRole = userRoles.data[0];
    const isEligible = await checkRoleScope(userRole, "create-folder");
    if (!isEligible) {
      throw new APIError(DOCUMENT_ROUTER.NO_FOLDER_DELETE_PERMISSION, 403);
    }
    if (!folderId) throw new Error(DOCUMENT_ROUTER.MANDATORY);
    const folderDetails = await folders.find({ _id: folderId });
    if (!folderDetails.length) {
      throw new Error(DOCUMENT_ROUTER.FOLDER_NOT_FOUND)
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
      throw new Error(DOCUMENT_ROUTER.INVALID_FILE_ID)
    }
    if (findDoc.status == 2) throw new Error(DOCUMENT_ROUTER.PUBLISH_CANT_BE_DELETE)
    let deletedDoc = await documents.update({ _id: docId, ownerId: userId }, { isDeleted: true }).exec()
    await createActivityLog({ activityType: "DOCUMENT_DELETED", activityBy: userId, documentId: docId })
    let isDocExists = await checkDocIdExistsInEs(docId)
    if (isDocExists) {
      let deleted = esClient.delete({
        index: `${ELASTIC_SEARCH_INDEX}_documents`,
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
  docsData.docs = documentsSort(docsData.docs, "name", false)
  return { page: docsData.page, pages: docsData.pages, foldersList: filteredFolders, docsList: docsData.docs };
}


export async function checkCapabilitiesForUserNew(objBody: any, userId: string) {
  try {
    let { docIds, userIds } = objBody
    if (!Array.isArray(docIds) || !Array.isArray(userIds)) throw new Error(DOCUMENT_ROUTER.INVALID_OR_MISSING_DATA);
    // if (objBody.unique) {
    //   if (userIds.some((user) => userIds.indexOf(user) !== userIds.lastIndexOf(user))) {
    //     throw new Error("Duplicate user ids found.");
    //   };
    // };
    let userObjects = (await userFindMany("_id", [... new Set(userIds.concat(userId))]) || []).map((user: any) => { return { ...user, type: "user" } })
    return await Promise.all(docIds.map(docId => loopUsersAndFetchDataNew(docId, userIds, userId, userObjects)))
  } catch (err) {
    throw err
  };
};

export async function checkCapabilitiesForUser(objBody: any, userId: string) {
  try {
    let { docIds, userIds } = objBody
    if (!Array.isArray(docIds) || !Array.isArray(userIds)) throw new Error(DOCUMENT_ROUTER.INVALID_OR_MISSING_DATA);
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
    let acceptCapabilities = ["owner", "collaborator", "viewer", "no_access"]
    let user = usersObjects.find(user => user._id == userId)
    let docRole: any
    if (!user) {
      user = { ...(await groupFindOne("_id", userId)), type: "group" }
      docRole = ((await GetDocCapabilitiesForUser(userId, docId, "group")).filter((capability: any) => acceptCapabilities.includes(capability))).pop()
    } else {
      docRole = ((await documnetCapabilities(docId, userId) as any || [""]).filter((capability: any, index: number, array: string[]) => {
        return (array.includes("all_cmp")) ? (capability == "all_cmp") ? "no_access" : false : acceptCapabilities.includes(capability)
      })).pop()
    }
    return {
      ...(user),
      docRole: (!docRole || docRole == "all_cmp") ? "no_access" : docRole
    }
  } catch (err) {
    throw err
  };
};

export async function shareDocForUsersNew(obj: any, userObj: any,host: string, token:string) {
  try {
    if ("add" in obj && obj.add.length) {
      await Promise.all(obj.add.map((obj: any) => invitePeople(obj.docId, [{ _id: obj.userId, type: obj.type }], obj.role, userObj._id,host,token)))
    } if ("edit" in obj && obj.edit.length) {
      await Promise.all(obj.edit.map((obj: any) => invitePeopleEdit(obj.docId, obj.userId, obj.type, obj.role, userObj)))
    } if ("remove" in obj && obj.remove.length) {
      await Promise.all(obj.remove.map((obj: any) => invitePeopleRemove(obj.docId, obj.userId, obj.type, obj.role, userObj,host,token)))
    }
    return { message: "successfully updated the roles." }
  } catch (err) {
    throw err
  };
};

export async function shareDocForUsers(obj: any) {
  try {
    if (!obj) throw new Error(DOCUMENT_ROUTER.INVALID_OR_MISSING_DATA)
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
    await Promise.all(users.map(userObj => invite(userObj, docId, role, doc, "")))
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
      throw new APIError(DOCUMENT_ROUTER.UNAUTHORIZED, 403);
    }
    if (!body.tags) { throw new Error(DOCUMENT_ROUTER.TAG_REQUIRED) }
    let [docData, child]: any = await Promise.all([documents.findById(docId).exec(), documents.find({ parentId: docId, isDeleted: false }).sort({ createdAt: -1 }).exec()])
    if (!docData) throw new Error(DOCUMENT_ROUTER.DOCUMENTS_NOT_THERE);
    if (!child.length) throw new Error(DOCUMENT_ROUTER.CHILD_NOT_FOUND);
    let usersData = await userFindMany("_id", [docData.ownerId, userId], { firstName: 1, middleName: 1, lastName: 1, email: 1, phone: 1, countryCode: 1, is_active: 1 })
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
      await createActivityLog({ activityType: "SUGGEST_TAGS", activityBy: userId, documentId: docId, tagsAdded: body.tags })
      webNotification({ notificationType: `DOCUMENTS`, userId: doc.ownerId, docId, title: DOC_NOTIFICATIONS.suggestTagNotification(doc.name), from: userId })
      sendNotification({ id: doc.ownerId, fullName: ownerName, userName, mobileNo, email: ownerDetails.email, documentUrl: `${ANGULAR_URL}/home/resources/doc/${docId}`, templateName: "suggestTagNotification", mobileTemplateName: "suggestTagNotification" });
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
          user: await userFindOne("id", docData.userId, { firstName: 1, middleName: 1, lastName: 1, email: 1, phone: 1, is_active: 1 }),
          role: await formateRoles(((await userRoleAndScope(docData.userId)) as any).data[0])
      };
  } catch (err) {
      throw err;
  }
}

export async function approveTags(docId: string, body: any, userId: string,host: string,token:string ) {
  try {
    if (!docId || !body.userId || (!body.tagIdToAdd && !body.tagIdToRemove)) { throw new Error(DOCUMENT_ROUTER.INVALID_OR_MISSING_DATA) }
    let docdetails: any = await documents.findById(docId)
    if (!docdetails) { throw new Error(DOCUMENT_ROUTER.DOCUMENTS_NOT_THERE) }
    let usersData = await userFindMany("_id", [userId, body.userId], { firstName: 1, middleName: 1, lastName: 1, email: 1, phone: 1, countryCode: 1, is_active: 1 })
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
      // let isDocExists = await checkDocIdExistsInEs(docId)
      // if (isDocExists) {
      //   let updatedData = esClient.update({
      //     index: `${ELASTIC_SEARCH_INDEX}_documents`,
      //     id: docId,
      //     body: {
      //       "script": {
      //         "source": "ctx._source.tags.addAll(params.tags)",
      //         "lang": "painless",
      //         "params": {
      //           "tags": tagNames,
      //         }
      //       }
      //     }
      //   })
      // }
      updateOrCreateDocInElasticSearch(docId,host,token)
      if (doc) {
        const { mobileNo, fullName } = getFullNameAndMobile(userDetails);
        await createActivityLog({ activityType: "SUGGEST_TAGS_ADD_APPROVED", activityBy: userId, documentId: docId, tagsAdded: body.tagIdToAdd })
        webNotification({ notificationType: `DOCUMENTS`, userId: body.userId, docId, title: DOC_NOTIFICATIONS.approveTagNotification(docdetails.name), from: userId })
        sendNotification({ id: body.userId, fullName: ownerName, userName, mobileNo, email: userDetails.email, documentUrl: `${ANGULAR_URL}/home/resources/doc/${docId}`, templateName: "approveTagNotification", mobileTemplateName: "approveTagNotification" });
        return {
          sucess: true,
          message: "Tag Adding approved successfully"
        }
      }
    }
    if (body.tagIdToRemove) {
      let tagExists = docdetails.tags.length && docdetails.tags.includes(body.tagIdToRemove)?true:false
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
      // let isDocExists = await checkDocIdExistsInEs(docId)
      // if (isDocExists && tagExists) {
      //   let updatedData = esClient.update({
      //     index: `${ELASTIC_SEARCH_INDEX}_documents`,
      //     id: docId,
      //     body: {
      //       "script": {
      //         "inline": "ctx._source.tags.remove(ctx._source.tags.indexOf(params.tags))",
      //         // "source": "ctx._source.tags.addAll(params.tags)",
      //         "lang": "painless",
      //         "params": {
      //           "tags": tagNames,
      //         }
      //       }
      //     }
      //   })
      // }
      updateOrCreateDocInElasticSearch(docId,host,token)
      if (doc) {
        const { mobileNo, fullName } = getFullNameAndMobile(userDetails);
        await createActivityLog({ activityType: "SUGGEST_TAGS_REMOVE_APPROVED", activityBy: userId, documentId: docId, tagsRemoved: body.tags })
        webNotification({ notificationType: `DOCUMENTS`, userId: body.userId, docId, title: DOC_NOTIFICATIONS.approveRemoveTagNotification(docdetails.name), from: userId })
        sendNotification({ id: body.userId, fullName: ownerName, userName, mobileNo, email: userDetails.email, documentUrl: `${ANGULAR_URL}/home/resources/doc/${docId}`, templateName: "approveTagNotification", mobileTemplateName: "approveTagNotification" });
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
    if (!docId || !body.userId || (!body.tagIdToAdd && !body.tagIdToRemove)) { throw new Error(DOCUMENT_ROUTER.INVALID_OR_MISSING_DATA) }
    let docdetails: any = await documents.findById(docId)
    if (!docdetails) { throw new Error(DOCUMENT_ROUTER.DOCUMENTS_NOT_THERE) }
    let usersData = await userFindMany("_id", [userId, body.userId], { firstName: 1, middleName: 1, lastName: 1, email: 1, phone: 1, countryCode: 1, is_active: 1 })
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
        await createActivityLog({ activityType: "SUGGEST_TAGS_ADD_REJECTED", activityBy: userId, documentId: docId, tagsRemoved: body.tagIdToAdd })
        webNotification({ notificationType: `DOCUMENTS`, userId: body.userId, docId, title: DOC_NOTIFICATIONS.rejectTagNotification(docdetails.name), from: userId })
        sendNotification({ id: body.userId, fullName: ownerName, userName, mobileNo, email: userDetails.email, documentUrl: `${ANGULAR_URL}/home/resources/doc/${docId}`, templateName: "rejectTagNotification", mobileTemplateName: "rejectTagNotification" });
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
        await createActivityLog({ activityType: "SUGGEST_TAGS_REMOVE_REJECTED", activityBy: userId, documentId: docId, tagsRemoved: body.tagIdToAdd })
        webNotification({ notificationType: `DOCUMENTS`, userId: body.userId, docId, title: DOC_NOTIFICATIONS.rejectRemoveTagNotification(docdetails.name), from: userId })
        sendNotification({ id: body.userId, fullName: ownerName, userName, mobileNo, email: userDetails.email, documentUrl: `${ANGULAR_URL}/home/resources/doc/${docId}`, templateName: "rejectTagNotification", mobileTemplateName: "rejectTagNotification" });
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

export async function mailAllCmpUsers(type: string, docDetails: any, allcmp: boolean = true, actionUser: string, text?: any) {
  try {
    let selectFields = { email: true, firstName: true, middleName: true, lastName: true, phone: true, is_active: true, countryCode: true }
    let users, sharedUsers: string, role: string
    if (allcmp) {
      users = await userList({ is_active: true, emailVerified: true }, selectFields)
    } else {
      let docInvited: any = await invitePeopleList(docDetails._id)
      if (Array.isArray(text)) docInvited.concat(text)
      let userIds = docInvited.filter((obj: any) => obj.type == "user").map(({ id }: any) => id)
      let groupIds = docInvited.filter((obj: any) => obj.type == "group").map(({ id }: any) => id)
      let groupUsers = await Promise.all(groupIds.map((group: string) => groupUserList(group)));
      userIds = userIds.concat(groupUsers.reduce((main: any[], curr: any) => main.concat(curr), [])).filter((userId: string) => userId != actionUser)
      users = await userFindMany("_id", userIds, selectFields);
      if (type == "invitePeopleDoc" || type == "invitePeopleEditDoc" || type == "invitePeopleRemoveDoc") {
        let actionedUsers = users.filter((user: any) => text.some((acUser: any) => acUser.id == user._id)).map((user: any) => `${user.firstName} ${user.middleName || ""} ${user.lastName || ""}`)
        users = users.filter((user: any) => docDetails.ownerId == user._id)
        sharedUsers = actionedUsers.length == 1 ? actionedUsers[0] : `${actionedUsers.slice(0, actionedUsers.lastIndexOf(",")) + " and " + actionedUsers.slice(actionedUsers.lastIndexOf(",") + 1)}`
        role = text[0].role
      }
    }
    if (users.length) {
      let allMailContent = await Promise.all(users.map(async (user: any) => {
        let fullName = `${user.firstName} ${user.middleName || ""} ${user.lastName || ""}`;
        let notificationMessage = (DOC_NOTIFICATIONS as any)[type](docDetails.name)
        if (type == "invitePeopleDoc") notificationMessage = DOC_NOTIFICATIONS.invitePeopleDoc(sharedUsers, role, docDetails.name)
        if (type == "documentUpdate") notificationMessage = DOC_NOTIFICATIONS.documentUpdate(text, docDetails.name)
        if(type != `invitePeopleDoc`){
          webNotification({ notificationType: `DOCUMENTS`, userId: user._id, docId: docDetails._id, title: notificationMessage, from: actionUser })
        }
        sendNotification({
          id: user._id,
          fullName, text,
          userName: fullName,
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
    if (!docId || (!body.tagIdToAdd && !body.tagIdToRemove)) { throw new Error(DOCUMENT_ROUTER.INVALID_OR_MISSING_DATA) }
    let docdetails: any = await documents.findById(docId)
    if (!docdetails) { throw new Error(DOCUMENT_ROUTER.DOCUMENTS_NOT_THERE) }
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
        // await createActivityLog({ activityType: "SUGGEST_TAGS_ADDED_MODIFIED", activityBy: userId, documentId: docId, tagsRemoved: body.tagIdToAdd })
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
        // await createActivityLog({ activityType: "SUGGEST_TAGS_ADDED_MODIFIED", activityBy: userId, documentId: docId, tagsRemoved: body.tagIdToAdd || body.tagIdToRemove })
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
    if (!Types.ObjectId.isValid(docId)) throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID)
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
    if (!Types.ObjectId.isValid(requestId)) throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID);
    let requestDetails: any = await docRequestModel.findById(requestId).populate("docId").exec();
    if (userObj._id != requestDetails.docId.ownerId) throw new Error(DOCUMENT_ROUTER.UNAUTHORIZED);
    let capability: any[] = await documnetCapabilities(requestDetails.docId.id, requestDetails.requestedBy);
    let addedCapability;
    if (capability.includes("no_access")) {
      addedCapability = await shareDoc(requestDetails.requestedBy, "user", requestDetails.docId.id, "viewer")
    } else if (capability.includes("viewer")) {
      let userCapability = await GetDocCapabilitiesForUser(requestDetails.requestedBy, requestDetails.docId.id)
      if (userCapability.length) await groupsRemovePolicy(`user/${requestDetails.requestedBy}`, requestDetails.docId.id, "viewer");
      addedCapability = await groupsAddPolicy(`user/${requestDetails.requestedBy}`, requestDetails.docId.id, "collaborator");
    } else {
      throw new Error(DOCUMENT_ROUTER.INVALID_ACTION_PERFORMED)
    }
    await createActivityLog({ activityType: "REQUEST_APPROVED", activityBy: userObj._id, documentId: requestDetails.docId.id, requestUserId: requestDetails.requestedBy })
    webNotification({ notificationType: `DOCUMENTS`, userId: requestDetails.requestedBy, docId: requestDetails.docId.id, title: DOC_NOTIFICATIONS.documentRequestApproved(requestDetails.docId.name), from: userObj._id })
    if (addedCapability && addedCapability.user.length) {
      await docRequestModel.findByIdAndUpdate(requestId, { $set: { isDelete: true } })
      return { message: "Shared successfully." }
    }
    throw new Error(DOCUMENT_ROUTER.SOMETHING_WENT_WRONG)
  } catch (err) {
    throw err;
  };
};

export async function requestDenied(requestId: string, userObj: any) {
  try {
    if (!Types.ObjectId.isValid(requestId)) throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID);
    let requestDetails: any = await docRequestModel.findById(requestId).populate("docId").exec();
    if (userObj._id != requestDetails.docId.ownerId) throw new Error(DOCUMENT_ROUTER.UNAUTHORIZED);
    let success = await docRequestModel.findByIdAndUpdate(requestId, { $set: { isDelete: true } }, {})
    await createActivityLog({ activityType: "REQUEST_DENIED", activityBy: userObj._id, documentId: requestDetails.docId.id, requestUserId: requestDetails.requestedBy })
    webNotification({ notificationType: `DOCUMENTS`, userId: requestDetails.requestedBy, docId: requestDetails.docId.id, title: DOC_NOTIFICATIONS.documentRequestRejected(requestDetails.docId.name), from: userObj._id })
    return success
  } catch (err) {
    throw err;
  }
}

export async function requestRaise(docId: string, userId: string) {
  try {
    if (!Types.ObjectId.isValid(docId) || !Types.ObjectId.isValid(userId)) throw new Error(DOCUMENT_ROUTER.INVALID_OR_MISSING_DATA);
    let docDetails: any = await documents.findById(docId);
    if (!docDetails || docDetails.parentId || docDetails.status == 2) throw new Error(DOCUMENT_ROUTER.INVALID_FILE_ID)
    let existRequest = await docRequestModel.findOne({ requestedBy: userId, docId: docId, isDelete: false })
    if (existRequest) throw new Error(DOCUMENT_ROUTER.ALREADY_REQUEST_EXIST)
    await createActivityLog({ activityType: "REQUEST_DOCUMENT", activityBy: userId, documentId: docId })
    // webNotification({ notificationType: `DOCUMENTS`, userId: docDetails.owner, docId: docId, title: DOC_NOTIFICATIONS.documentRequest(docDetails.name), from: userId })
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
      throw new APIError(DOCUMENT_ROUTER.UNAUTHORIZED, 403);
    }
    let data = await documents.find({ parentId: null, status: { $ne: STATUS.DRAFT } }).collation({ locale: 'en' }).sort({ name: 1 });
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
    let userDetails: any = await userFindOne("id", newOwnerId, { firstName: 1, middleName: 1, lastName: 1, name: 1 })
    let userName: any;
    if (userDetails.firstName)
      userName = `${userDetails.firstName} ${userDetails.middleName || ""} ${userDetails.lastName || ""}`;
    else {
      userName = userDetails.name
    }
    let sharedDocIds = (await GetDocIdsForUser(ownerId)).filter(id => Types.ObjectId.isValid(id))
    let [mydocs, sharedDocs]: any = await Promise.all([
      documents.find({ ownerId: ownerId, parentId: null, isDeleted: false, status: { $ne: STATUS.DRAFT } }).exec(),
      documents.find({ _id: { $in: sharedDocIds }, isDeleted: false }).exec()
    ])
    await Promise.all(mydocs.map((doc: any) => {
      changeOwnerShip(doc, ownerId, newOwnerId, userObj),
        replaceUserInES(doc.id, newOwnerId, userName)
    }
    ))
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
      // await createActivityLog({
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
    await createActivityLog({
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


export async function getAllPublicDocuments(currentPage = 1, limit = 20, host: string, tags: any, search: string) {
  // const isEligible = await checkRoleScope(userRole, 'view-all-public-documents')
  // if(!isEligible){
  //   throw new APIError(DOCUMENT_ROUTER.VIEW_PUBLIC_DOCS_DENIED)
  // }
  let query: any = {isPublic: true}
  if(search){
    query = {...query, name:new RegExp(search, 'i')}
  }
  let { docs, page, pages } = await documents.paginate(query, { page: currentPage, limit })
  docs = await Promise.all(docs.map(doc => docData(doc, host)))
  if(tags){
    tags = tags.split(`,`)
    if(tags.length){
      docs = docs.filter((doc: any) => doc.tags.some((tag: any) => tags.includes(tag.tag)))
      pages = manualPagination(currentPage, limit, docs).pages
    }
  }
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
      throw new APIError(DOCUMENT_ROUTER.UNAUTHORIZED, 403);
    }
    if (!body.addTags && !body.removeTags) { throw new Error(DOCUMENT_ROUTER.MANDATORY) }
    let [docData, child]: any = await Promise.all([
      documents.findById(docId).exec(),
      documents.find({ parentId: docId, isDeleted: false }).sort({ createdAt: -1 }).exec()
    ])
    if (!docData) throw new Error(DOCUMENT_ROUTER.DOCUMENTS_NOT_THERE);
    if (!child.length) throw new Error(DOCUMENT_ROUTER.CHILD_NOT_FOUND);
    let usersData = await userFindMany("_id", [docData.ownerId, userId], { firstName: 1, middleName: 1, lastName: 1, email: 1 })
    let ownerDetails = usersData.find((user: any) => docData.ownerId == user._id)
    let ownerName = `${ownerDetails.firstName} ${ownerDetails.middleName || ""} ${ownerDetails.lastName || ""}`;
    let userDetails = usersData.find((user: any) => userId == user._id)
    let userName = `${userDetails.firstName} ${userDetails.middleName || ""} ${userDetails.lastName || ""}`;
    let addSuggestedTagsExist = docData.suggestTagsToAdd.filter(({ userId: user }: any) => user == userId).map(({ tags }: any) => tags).reduce((main: [], curr: any) => main.concat(curr), [])
    let removeSuggestedTagsExist = docData.suggestTagsToRemove.filter(({ userId: user }: any) => user == userId).map(({ tags }: any) => tags).reduce((main: [], curr: any) => main.concat(curr), [])
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
      let addedTags = body.addTags.filter((tag: string) => !addSuggestedTagsExist.includes(tag))
      let removedTags = body.removeTags.filter((tag: string) => !removeSuggestedTagsExist.includes(tag))
      if (addedTags.length || removedTags.length) {
        // await createActivityLog({ activityType: "SUGGEST_MODIFIED_TAGS", activityBy: userId, documentId: docId, tagsAdded: body.addTags, tagsRemoved: body.removeTags })
        webNotification({ notificationType: `DOCUMENTS`, userId: doc.ownerId, docId, title: DOC_NOTIFICATIONS.suggestTagNotification(doc.name), from: userId })
        sendNotification({ id: userId, fullName: ownerName, userName, mobileNo, email: ownerDetails.email, documentUrl: `${ANGULAR_URL}/home/resources/doc/${docId}`, templateName: "suggestTagNotification", mobileTemplateName: "suggestTagNotification" });
      }
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
export async function searchDoc(search: string, userId: string, page: number = 1, limit: number = 30, pagination: boolean = true, searchAllCmp: boolean = false) {
  try {
    let userRoles = await userRoleAndScope(userId);
    let userRole = userRoles.data[0];
    let data: any;

    const isEligible = await checkRoleScope(userRole, "view-all-cmp-documents");
    if (isEligible && searchAllCmp) {
      if (search == (null || "")) {
        data = {
          query: {
            "match_all": {}
          }
        }
      } else {
        data = {
          query: {
            multi_match: {
              "query": search,
              "fields": ['name', 'description', 'userName', 'tags', 'type', 'groupName', 'fileName','projectName','city','reference','phases'],
              "type": 'bool_prefix'
            }
          }
        }
      }
    } else {
      if (search == (null || "")) {
        data = {
          query: {
            multi_match: { "query": `${userId} 2`, "fields": ['accessedBy', 'status'] },
          }
        }
      }
      else {
        data = {
          query: {
            bool: {
              "should": [
                {
                  "bool": {
                    "must": [
                      { multi_match: { "query": search, "fields": ['name', 'description', 'userName', 'tags', 'type', 'fileName', 'groupName','projectName','city','reference','phases'], type: 'bool_prefix' } },
                      { multi_match: { "query": `${userId} 2`, "fields": ['accessedBy', 'status'] } },
                    ]
                  }
                }]
            }
          }
        }
      }
    }
    let searchdoc: any = await esClient.search({
      index: `${ELASTIC_SEARCH_INDEX}_documents`,
      size: 1000,
      body: data
    });
    let searchResult = searchdoc.hits.hits.map((doc: any) => {
      return {
        _id: doc._source.id,
        accessedBy: doc._source.accessedBy,
        userName: doc._source.userName,
        name: doc._source.name,
        description: doc._source.description,
        tags: doc._source.tags,
        thumbnail: doc._source.thumbnail,
        status: doc._source.status,
        fileName: doc._source.fileName,
        updatedAt: doc._source.updatedAt,
        createdAt: doc._source.createdAt,
        groupId: doc._source.groupId,
        groupName: doc._source.groupName,
        createdByMe: doc._source.createdBy == userId,
        projectId: doc._source.projectId,
        projectName: doc._source.projectName,
        city: doc._source.city,
        reference: doc._source.reference,
        phases: doc._source.phases
      }
    })
    if (pagination == true) return manualPagination(page, limit, searchResult);
    else return { docs: searchResult };
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function updateUserInDOcs(id: any, userId: string,host: string,token:string) {
  try {
    // let userIds, userNames;
    let allDocIds: any = []
    // let collaboratedDocsIds: any = await GetDocIdsForUser(id, "user", ["collaborator", "owner","viewer"])
    let groups:any = await userGroupsList(id)
    allDocIds = groups && groups.lenght?(await Promise.all(groups.map((groupId: string) => GetDocIdsForUser(groupId, "group")))):[]
    allDocIds = allDocIds.reduce((main: [], arr: []) => main.concat(arr), [])
    allDocIds = [... new Set(allDocIds.concat(await GetDocIdsForUser(id,"user", ["collaborator", "owner","viewer"])))].filter((id: any) => Types.ObjectId.isValid(id));
    // let userIds = await Promise.all(allDocIds.map(async (docId: any) => {
    //   return {
    //     docId: docId,
    //     collaboratorIds: await GetUserIdsForDocWithRole(docId, "collaborator"),
    //     ownerIds: await GetUserIdsForDocWithRole(docId, "owner"),
    //     viewerIds: await GetUserIdsForDocWithRole(docId, "viewer")
    //   }
    // })
    // )
    // let idsToUpdate = await Promise.all(userIds.map(async (user: any) => {
    //   return {
    //     docId: user.docId,
    //     userNames: await Promise.all([...user.collaboratorIds, ...user.ownerIds].map(async (eachuser: any) => {
    //       let userId = eachuser.split('/')[1]
    //       let userDetails: any = await userFindOne("id", userId, { firstName: 1, middleName: 1, lastName: 1, name: 1 })
    //       if (userDetails) {
    //         if (userDetails.firstName)
    //           return `${userDetails.firstName} ${userDetails.middleName || ""} ${userDetails.lastName || ""}`;
    //         else
    //           return userDetails.name
    //       }
    //     })),
    //     userIds: [...user.collaboratorIds, ...user.ownerIds, ...user.viewerIds].map((eachuser: any) => {
    //       return eachuser.split('/')[1]
    //     })
    //   }
    // }))
    // let allDocs: any = await esClient.search({
    //   index: `${ELASTIC_SEARCH_INDEX}_documents`,
    //   size: 1000,
    //   body: {
    //     query: {
    //       "match_all": {}
    //     }
    //   }
    // })

    // let docIds = allDocs.hits.hits.map((doc: any) => { return doc._id })

    // let updateUsers = await Promise.all(idsToUpdate.map(async (user: any) => {
    //   // if (docIds.includes(user.docId)) {
    //     return await esClient.update({
    //       index: `${ELASTIC_SEARCH_INDEX}_documents`,
    //       id: user.docId,
    //       body: {
    //         "script": {
    //           "source": "ctx._source.accessedBy=(params.userId);ctx._source.userName=(params.userNames)",
    //           "lang": "painless",
    //           "params": {
    //             "userId": user.userIds,
    //             "userNames": user.userNames
    //           }
    //         }
    //       }
    //     })
    //   // }
    // }))
    let updateUsers = await Promise.all(allDocIds.map(async(docId:any)=>{
      return await updateOrCreateDocInElasticSearch(docId,host,token)
    }))
    return { allDocIds, updateUsers }

  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function updateTagsInDOcs(bodyObj: any, token: string,host:string) {
  try {

    // let allDocs: any = await esClient.search({
    //   index: `${ELASTIC_SEARCH_INDEX}_documents`,
    //   size: 1000,
    //   body: {
    //     query: {
    //       "match_all": {}
    //     }
    //   }
    // })

    // let docIds = allDocs.hits.hits.map((doc: any) => { return doc._id })

    let updateTags = await Promise.all(bodyObj.map(async (tag: any) => {
      updateOrCreateDocInElasticSearch(tag.docId,host,token)
      // if (docIds.includes(tag.docId)) {
        // return await esClient.update({
        //   index: `${ELASTIC_SEARCH_INDEX}_documents`,
        //   id: tag.docId,
        //   body: {
        //     "script": {
        //       "source": "ctx._source.tags=(params.tags)",
        //       "lang": "painless",
        //       "params": {
        //         "tags": tag.tags
        //       }
        //     }
        //   }
        // })
      // }
    }))

    return { updateTags }

  } catch (error) {
    console.error(error);
    throw error;
  }
}

async function checkDocIdExistsInEs(docId: string) {
  let checkDoc: any = await esClient.search({
    index: `${ELASTIC_SEARCH_INDEX}_documents`,
    size: 1000,
    body: {
      query: {
        "match": { id: docId }
      }
    }
  })
  if (checkDoc.hits.hits.length) {
    return true
  } else {
    return false
  }
}

export async function addGroupMembersInDocs(id: any, host: string, token: string) {
  try {

    let groupDocIds: any = await GetDocIdsForUser(id, "group", ["collaborator", "viewer", "owner"])
    let idsToUpdate = await Promise.all(groupDocIds.map(async (docId: any) => {
      return await updateOrCreateDocInElasticSearch(docId,host,token)
      // {
      //   docId: docId,
      //   userNames: await Promise.all(groupUserIds.map(async (eachuser: any) => {
      //     let userDetails: any = await userFindOne("id", eachuser, { firstName: 1, middleName: 1, lastName: 1, name: 1 })
      //     if (userDetails) {
      //       if (userDetails.firstName)
      //         return `${userDetails.firstName} ${userDetails.middleName || ""} ${userDetails.lastName || ""}`;
      //       else
      //         return userDetails.name
      //     }
      //   })),
      //   userIds: groupUserIds
      // }
    }))
    // let allDocs: any = await esClient.search({
    //   index: `${ELASTIC_SEARCH_INDEX}_documents`,
    //   size: 1000,
    //   body: {
    //     query: {
    //       "match_all": {}
    //     }
    //   }
    // })

    // let docIds = allDocs.hits.hits.map((doc: any) => { return doc._id })

    // let updateUsers = Promise.all(idsToUpdate.map(async (user: any) => {
    //   // if (docIds.includes(user.docId)) {
    //     return await esClient.update({
    //       index: `${ELASTIC_SEARCH_INDEX}_documents`,
    //       id: user.docId,
    //       body: {
    //         "script": {
    //           "source": "ctx._source.accessedBy.addAll(params.userId);ctx._source.userName.addAll(params.userNames)",
    //           "lang": "painless",
    //           "params": {
    //             "userId": user.userIds,
    //             "userNames": user.userNames
    //           }
    //         }
    //       }
    //     })
    //   // }
    // }))

    return { idsToUpdate }

  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function removeGroupMembersInDocs(id: any, host: string, token: string) {
  try {

    let groupDocIds: any = await GetDocIdsForUser(id, "group", ["collaborator", "viewer", "owner"])
    let idsToUpdate = await Promise.all(groupDocIds.map(async (docId: any) => {
      return await updateOrCreateDocInElasticSearch(docId,host,token)
      // let userDetails: any = await userFindOne("id", groupUserId, { firstName: 1, middleName: 1, lastName: 1, name: 1 })
      // if (userDetails) {
      //   if (userDetails.firstName)
      //     userDetails = `${userDetails.firstName} ${userDetails.middleName || ""} ${userDetails.lastName || ""}`;
      //   else
      //     userDetails = userDetails.name
      // }
      // return {
      //   docId: docId,
      //   userName: userDetails,
      //   userId: groupUserId
      // }
    }))
    // let allDocs: any = await esClient.search({
    //   index: `${ELASTIC_SEARCH_INDEX}_documents`,
    //   size: 1000,
    //   body: {
    //     query: {
    //       "match_all": {}
    //     }
    //   }
    // })

    // let docIds = allDocs.hits.hits.map((doc: any) => { return doc._id })

    // let updateUsers = await Promise.all(idsToUpdate.map(async (user: any) => {
    //   // if (docIds.includes(user.docId)) {
    //     return await esClient.update({
    //       index: `${ELASTIC_SEARCH_INDEX}_documents`,
    //       id: user.docId,
    //       body: {
    //         "script": {
    //           "inline": "ctx._source.accessedBy.remove(ctx._source.accessedBy.indexOf(params.userId));ctx._source.userName.remove(ctx._source.userName.indexOf(params.userName))",
    //           "lang": "painless",
    //           "params": {
    //             "userId": user.userId,
    //             "userName": user.userName
    //           }
    //         }
    //       }
    //     })
    //   // }
    // }))

    return { idsToUpdate }

  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function getDocsAndInsertInElasticSearch(host: string,token:string) {
  const docs = await documents.find({ status: { $ne: 0 }, parentId: null, isDeleted: false }).exec()
  const finalData: any = await Promise.all(docs.map(doc => getShareInfoForEachDocument(doc, host,token)))

  let insert = await Promise.all(finalData.map(async (doc: any) => {
    return esClient.index({
      index: `${process.env.ELASTIC_SEARCH_INDEX}_documents`,
      body: doc,
      id: doc.id
    });
  }))
  return insert;
  // return doc;
  // connect to elastic search, remove old doc data & add finalData
}

async function getShareInfoForEachDocument(doc: any, host: string,token:string) {
  const [collaboratorIds, viewerIds, ownerIds] = await Promise.all([
    GetUserIdsForDocWithRole(doc.id, 'collaborator'),
    GetUserIdsForDocWithRole(doc.id, 'viewer'),
    GetUserIdsForDocWithRole(doc.id, 'owner')
  ])
  const userIds = Array.from(new Set([
    ...collaboratorIds.map((collaboratorId: any) => collaboratorId.split(`/`)[1]),
    ...ownerIds.map((ownerId: any) => ownerId.split(`/`)[1]),
    ...viewerIds.map((viewerId: any) => viewerId.split(`/`)[1])
  ]))
  const usersInfo: any[] = await userFindMany(`_id`, userIds, { firstName: 1, middleName: 1, lastName: 1 })
  const fetchedUserIds = usersInfo.map(user => user._id)
  const groupIds = userIds.filter(userId => !fetchedUserIds.includes(userId))
  let groupMembers: any[] = await Promise.all(groupIds.map(groupId => groupUserList(groupId)))
  groupMembers = groupMembers.reduce((p, c) => [...p, ...c], [])
  const [groupMembersInfo, groupsInfo, tagsData]: any = await Promise.all([
    userFindMany(`_id`, groupMembers),
    groupsFindMany('_id', groupIds),
    tags.find({ _id: { $in: doc.tags.filter((tag: any) => Types.ObjectId.isValid(tag)) } }).exec()
  ])
  const userNames = Array.from(new Set(usersInfo.concat(groupMembersInfo))).map(userInfo => (`${userInfo.firstName} ${userInfo.middleName || ``} ${userInfo.lastName}`) || `${userInfo.name}`)
  let fileType = doc.fileName ? (doc.fileName.split(".")).pop() : ""
  let projectDetails = await getProjectDetailsForES(doc.id,token)
  return {
    docId: doc.id,
    accessedBy: userIds,
    userName: userNames,
    name: doc.name,
    description: doc.description,
    tags: tagsData.map((tag: any) => tag.tag),
    thumbnail: (fileType == "jpg" || fileType == "jpeg" || fileType == "png") ? `${host}/api/docs/get-document/${doc.fileId}` : "N/A",
    status: doc.status,
    fileName: doc.fileName,
    updatedAt: doc.updatedAt,
    createdAt: doc.createdAt,
    id: doc.id,
    groupId: groupIds,
    groupName: groupsInfo.map((group: any) => group.name),
    createdBy: doc.ownerId,
    // projectName: [],
    // city: [],
    // reference: [],
    projectId:projectDetails&& projectDetails.projectId?projectDetails.projectId:[], 
    projectName: projectDetails&& projectDetails.projectName?projectDetails.projectName:[],
    city: projectDetails&& projectDetails.city?projectDetails.city:[],
    reference: projectDetails&& projectDetails.reference?projectDetails.reference:[],
    phases: projectDetails&& projectDetails.phases?projectDetails.phases:[],
  }
}

//  Get Doc Details
export async function getDocDetailsForSuccessResp(docId: any, userId: string, token: string, allCmp: boolean) {
  try {
    if (!Types.ObjectId.isValid(docId)) throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID);
    let publishDocs: any = await documents.findById(docId);
    const [allCmp, allFinancial] = await Promise.all([
      checkRoleScope(((await userRoleAndScope(userId) as any).data || [""])[0], "view-all-cmp-documents"),
      checkRoleScope(((await userRoleAndScope(userId) as any).data || [""])[0], "view-all-finanacial-documents")
    ]);
    if (!allCmp || !allFinancial) {
      if (publishDocs.isDeleted) throw new Error(DOCUMENT_ROUTER.DOCUMENT_DELETED(publishDocs.name))
      if (publishDocs.status != 2 && publishDocs.parentId == null) {
        let userCapability = await documnetCapabilities(publishDocs.parentId || publishDocs._id, userId)
        if (!userCapability.length) throw new Error(DOCUMENT_ROUTER.USER_HAVE_NO_ACCESS)
      }
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
    let [tagObjects, ownerRole, ownerObj, taskDetailsObj] = await Promise.all([
      getTags((docList.tags && docList.tags.length) ? docList.tags.filter((tag: string) => Types.ObjectId.isValid(tag)) : []),
      userRoleAndScope(docList.ownerId),
      userFindOne("id", docList.ownerId, { firstName: 1, lastName: 1, middleName: 1, email: 1, phone: 1, countryCode: 1, is_active: 1 }),
      getTasksForDocument(docList.parentId || docList._id, token),
    ])
    let projectIds = taskDetailsObj.filter(({ projectId }: any) => projectId).map(({ projectId }: any) => projectId)
    let projectDetails = await project_schema.find({ $or: [{ _id: { $in: projectIds || [] } }, { "funds.released.documents": { $in: [docId] } }, { "funds.utilized.documents": { $in: [docId] } }] }, { name: 1, city: 1, reference: 1, phases:1 }).exec()
    projectDetails = (await Promise.all(projectDetails.map(project => mapPhases(project)))).map(project =>({...project, phase:getCurrentPhase(project) || {}}))
    // await createActivityLog({ activityType: `DOCUMENT_VIEWED`, activityBy: userId, documentId: docId })
    return {
      ...docList, tags: tagObjects,
      owner: { ...ownerObj, role: await formateRoles((ownerRole.data || [""])[0]) },
      taskDetails: taskDetailsObj, projectDetails,
      sourceId: docList.sourceId ? await documents.findById(docList.sourceId).exec() : ''
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}
export async function replaceUserInES(docId: string, newUserId: string, newUserName: string) {
  try {
    let isDocExists = await checkDocIdExistsInEs(docId)
    if (isDocExists) {
      let data = esClient.update({
        index: `${ELASTIC_SEARCH_INDEX}_documents`,
        id: docId,
        body: {
          "script": {
            "source": "ctx._source.accessedBy.add(params.userId);ctx._source.userName.add(params.userName)",
            "lang": "painless",
            "params": {
              "userId": newUserId,
              "userName": newUserName
            }
          }
        }
      })
      return data;
    }
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function bulkUploadDocument(filePath: any, userObj: any, siteConstants: any, token: string) {
  try {
    const excelFormattedData = importExcelAndFormatData(filePath)
    if (!excelFormattedData.length) {
      throw new APIError(DOCUMENT_ROUTER.UPLOAD_EMPTY_FOLDER)
    }
    let formateExcel: any = await bulkValidation(excelFormattedData, userObj, siteConstants)
    await Promise.all(formateExcel.map((excelObj: any) => documentCreateApi(excelObj["Document Name"], join(__dirname, excelObj.Location, excelObj.Filename), excelObj.Tags ? excelObj.Tags.split() : [], token, userObj)))
    return { success: true, message: "documents created successfully" }
  } catch (error) {
    throw error
  }
}

async function bulkValidation(excelFormattedData: any[], userObj: any, siteConstants: any): Promise<boolean> {
  try {
    let EXCEL_KEYS = ["Document Name", "Access", "Edit Access", "Filename", "Location", "Ownership", "View Access", "Tags"]
    let ACCESS: string[] = ["Public Document"]
    let [existDocuments, userObjs] = await Promise.all([
      documents.find({ isDeleted: false, parentId: null, ownerId: userObj._id }).exec(),
      userList({ is_active: true, emailVerified: true }, { email: true })
    ]);
    let currentUsers = userObjs.map(({ email }: any) => email)

    let formateExcel = excelFormattedData.reduce((main, curr) => {
      let currObj = Object.keys(curr).reduce((main, currStr) => (Object.assign({}, main, { [currStr.trim()]: typeof (curr[currStr]) == "string" ? (curr[currStr]).trim() : curr[currStr] })), {})
      return main.concat([currObj])
    }, [])
    let newDocumentsNames = formateExcel.map((obj: any) => obj["Document Name"])
    if (newDocumentsNames.some((name: string) => newDocumentsNames.indexOf(name) != newDocumentsNames.lastIndexOf(name))) {
      throw new Error("Duplicate document names found.")
    }
    let oldDocsNames = existDocuments.map(({ name }: any) => name)
    if (newDocumentsNames.some((name: string) => oldDocsNames.includes(name))) {
      throw new Error("A document found with same name.")
    }

    if (formateExcel.some(({ "Document Name": name }: any) => name.length > siteConstants.docNameLength)) {
      throw new Error(`Document Name length should less than ${siteConstants.docNameLength}`)
    }

    if (formateExcel.some(({ Access }: any) => Access && !ACCESS.includes(Access))) {
      throw new Error("Invalid key found in access column")
    }

    if (formateExcel.some(({ Location, Filename }: any) => !existsSync(join(__dirname, Location, Filename)))) {
      throw new Error("File not Found.")
    }

    if (formateExcel.some(({ Ownership, "View Access": Access, "Edit Access": Edit }: any) =>
      (!currentUsers.includes(Ownership) || (Access.split()).some((viewer: string) => !currentUsers.includes(viewer)) ||
        (Edit.split()).some((editor: string) => !currentUsers.includes(editor))))) {
      throw new Error("user mail not exists in db.")
    }

    if (formateExcel.some(({ Ownership, "View Access": Access, "Edit Access": Edit }: any) => {
      let docMails = [Ownership, ...(Access.split()), ...(Edit.split())]
      return docMails.some(mail => docMails.indexOf(mail) != docMails.lastIndexOf(mail))
    })) {
      throw new Error("Duplicate mails found in document.")
    }
    return formateExcel
  } catch (err) {
    throw err;
  }
}

async function getTagIdWithNames(tagNames: string[], userObj: any) {
  let arrayTagObjs = await Promise.all(tagNames.map(tag => getTag(tag)))
  let unCreatedTags: any = arrayTagObjs.filter((anything) => typeof (anything) == "string")
  unCreatedTags = await Promise.all(unCreatedTags.map((tag: string) => add_tag({ tag }, userObj)))
  arrayTagObjs = arrayTagObjs.filter((anything) => typeof (anything) != "string")
  return [...arrayTagObjs, ...unCreatedTags].map(obj => obj.id || typeof (obj._id) != "string" ? obj._id.toString() : obj._id).filter(id => Types.ObjectId(id))
}
async function getTag(tag: string) {
  return await tags.find({ tag }) || tag
}

async function documentCreateApi(name: string, filepath: any, tags: string[], token: string, userObj: any) {
  let tagId = await getTagIdWithNames(tags, userObj)
  await request({
    method: "POST",
    url: process.env.CMP_URL || "http://localhost:3000",
    port: 3000,
    headers: {
      "Authorization": "Basic " + token,
      "Content-Type": "multipart/form-data"
    },
    form: {
      "docName": name,
      "upfile": readFileSync(filepath),
      "tags": tags
    }
  })
}

//update project names, cities, reference in documents for search.
export async function getProjectNamesForES(docIds: any[], host:string,token: string) {
  let docsUpdate = await Promise.all(docIds&&docIds.length?docIds.map(async(docId)=>{
    return await updateOrCreateDocInElasticSearch(docId,host,token)
  // let publishDocs: any = await documents.findById(docId);
  // const docList = publishDocs.toJSON();
  // let taskDetailsObj: any = await getTasksForDocument(docList.parentId || docList._id, token)
  // let projectIds = taskDetailsObj.filter(({ projectId }: any) => projectId).map(({ projectId }: any) => projectId)
  // let projectDetails = await project_schema.find({ $or: [{ _id: { $in: projectIds || [] } }, { "funds.released.documents": { $in: [docId] }, "funds.released.deleted":false}, { "funds.utilized.documents": { $in: [docId] },"funds.utilized.deleted":false }] }).exec()
  // // let projectDetailsForDeletedDocs = await project_schema.find({ $or: [{ "funds.released.documents": { $in: [docId] }, "funds.released.deleted":true}, { "funds.utilized.documents": { $in: [docId] },"funds.utilized.deleted":true }] }).exec()
  // let projectName: any = [];
  // let city: any = [];
  // let reference: any = [];
  // let projects = projectDetails.map((project: any) => {
  //   projectName.push(project.name);
  //   city.push(project.city?project.city:null);
  //   reference.push(project.reference?project.reference:null);
  // })
  // if (projectName.length) {
  //   let updatedData = esClient.update({
  //     index: `${ELASTIC_SEARCH_INDEX}_documents`,
  //     id: docId,
  //     body: {
  //       "script": {
  //         "source": "ctx._source.projectName=params.projectName;ctx._source.city=params.city;ctx._source.reference=params.reference;",
  //         "lang": "painless",
  //         "params": {
  //           "projectName": projectName,
  //           "city": city,
  //           "reference": reference
  //         }
  //       }
  //     }
  //   })
  // }
}):[]
  )
}

export async function updateGroupInElasticSearch(groupId: string,host:string,token:string) {
  let docIds = await GetDocIdsForUser(groupId, "group")
  let update = await Promise.all(docIds&& docIds.length ? docIds.map(async (docId: any) => {
    return await updateOrCreateDocInElasticSearch(docId,host,token)
    // let groupDetails = await invitePeopleList(docId);
    // let groupData = groupDetails && groupDetails.length ? groupDetails.filter((group: any) => group.type == 'group') : []
    // let groupNames = groupData && groupData.length ? (groupData.map((group: any) => { return group.name })) : []
    // let isDocExists = await checkDocIdExistsInEs(docId)
    // if (isDocExists) {
    //   if (groupNames && groupNames.length) {
    //     let updatedData =  esClient.update({
    //       index: `${ELASTIC_SEARCH_INDEX}_documents`,
    //       id: docId,
    //       body: {
    //         "script": {
    //           "source": "ctx._source.groupName=(params.groupName);",
    //           "lang": "painless",
    //           "params": {
    //             "groupName": groupNames
    //           }
    //         }
    //       }
    //     })
    //   }
    // }
  }
  ):[])
}

export async function approveTagsAuto(docId: string, addTags: any, removedtags: any ) {
  try {
    let docdetails: any = await documents.findById(docId)
    if (!docdetails) { throw new Error(DOCUMENT_ROUTER.DOCUMENTS_NOT_THERE) }
    if (addTags && addTags.length) {
      let filteredDoc: any = await Promise.all(
        docdetails.suggestTagsToAdd.map(
          (_respdata: any) => {
            return {
              userId: _respdata.userId,
              tags: _respdata.tags.filter((tag: any) => !addTags.includes(tag))
            }
          })
      )
      let doc = await documents.findByIdAndUpdate(docId, { suggestTagsToAdd: filteredDoc})
        return {
          sucess: true,
          message: "Tag Adding approved successfully"
        }
      }
    
    if (removedtags && removedtags.length) {
      let suggestedToRemove: any = await Promise.all(
        docdetails.suggestTagsToRemove.map(
          (_respdata: any) => {
            return {
              userId: _respdata.userId,
              tags: _respdata.tags.filter((tag: any) => !removedtags.includes(tag))
            }
          })
      )
      let doc = await documents.findByIdAndUpdate(docId, { suggestTagsToRemove: suggestedToRemove})
      }
  } catch (err) {
    throw err
  };
};

export async function getProjectDetailsForES(docId: string, token: string) {
  let publishDocs: any = await documents.findById(docId);
  const docList = publishDocs.toJSON();
  let taskDetailsObj: any = await getTasksForDocument(docList.parentId || docList._id, token)
  let projectIds = taskDetailsObj.filter(({ projectId }: any) => projectId).map(({ projectId }: any) => projectId)
  let projectDetails = await project_schema.find({ $or: [{ _id: { $in: projectIds || [] } }, { "funds.released.documents": { $in: [docId] },"funds.released.deleted":false }, { "funds.utilized.documents": { $in: [docId] },"funds.utilized.deleted":false }] }).exec()
  let projectName: any = [];
  let city: any = [];
  let reference: any = [];
  let projectId: any = [];
  let projects = projectDetails.map((project: any) => {
    projectId.push(project._id || project.id)
    projectName.push(project.name);
    city.push(project.city?project.city:null);
    reference.push(project.reference?project.reference:null);
  })
  let phases = await backGroudJobForPhaseDocs(projectId)
  return{ projectId,projectName,city,reference ,phases}
}

async function createActivityLog(activity: any) {
  if(activity.documentId){
    const docDetail: any = await documents.findById(activity.documentId).exec()
    if(docDetail.parentId){
      activity.documentId = docDetail.parentId
    }
  }
  return await create(activity)
}


async function updateOrCreateDocInElasticSearch(docId: string, host: string,token:string) {
  const doc:any = await documents.findById(docId).exec()
  const [collaboratorIds, viewerIds, ownerIds] = await Promise.all([
    GetUserIdsForDocWithRole(doc.id, 'collaborator'),
    GetUserIdsForDocWithRole(doc.id, 'viewer'),
    GetUserIdsForDocWithRole(doc.id, 'owner')
  ])
  const userIds = Array.from(new Set([
    ...collaboratorIds.map((collaboratorId: any) => collaboratorId.split(`/`)[1]),
    ...ownerIds.map((ownerId: any) => ownerId.split(`/`)[1]),
    ...viewerIds.map((viewerId: any) => viewerId.split(`/`)[1])
  ]))
  const usersInfo: any[] = await userFindMany(`_id`, userIds, { firstName: 1, middleName: 1, lastName: 1 })
  const fetchedUserIds = usersInfo.map(user => user._id)
  const groupIds = userIds.filter(userId => !fetchedUserIds.includes(userId))
  let groupMembers: any[] = await Promise.all(groupIds.map(groupId => groupUserList(groupId)))
  groupMembers = groupMembers.reduce((p, c) => [...p, ...c], [])
  const [groupMembersInfo, groupsInfo, tagsData]: any = await Promise.all([
    userFindMany(`_id`, groupMembers),
    groupsFindMany('_id', groupIds),
    tags.find({ _id: { $in: doc.tags.filter((tag: any) => Types.ObjectId.isValid(tag)) } }).exec()
  ])
  const userNames = Array.from(new Set(usersInfo.concat(groupMembersInfo))).map(userInfo => (`${userInfo.firstName} ${userInfo.middleName || ``} ${userInfo.lastName}`) || `${userInfo.name}`)
  let fileType = doc.fileName ? (doc.fileName.split(".")).pop() : ""
  let projectDetails = await getProjectDetailsForES(doc.id,token)
  let docObj =  {
    docId: doc.id,
    accessedBy: userIds,
    userName: userNames,
    name: doc.name,
    description: doc.description,
    tags: tagsData.map((tag: any) => tag.tag),
    thumbnail: (fileType == "jpg" || fileType == "jpeg" || fileType == "png") ? `${host}/api/docs/get-document/${doc.fileId}` : "N/A",
    status: doc.status,
    fileName: doc.fileName,
    updatedAt: doc.updatedAt,
    createdAt: doc.createdAt,
    id: doc.id,
    groupId: groupIds,
    groupName: groupsInfo.map((group: any) => group.name),
    createdBy: doc.ownerId,
    // projectName: [],
    // city: [],
    // reference: [],
    projectId:projectDetails&& projectDetails.projectId?projectDetails.projectId:[], 
    projectName: projectDetails&& projectDetails.projectName?projectDetails.projectName:[],
    city: projectDetails&& projectDetails.city?projectDetails.city:[],
    reference: projectDetails&& projectDetails.reference?projectDetails.reference:[],
    phases: projectDetails&& projectDetails.phases?projectDetails.phases:[],
  }

  let idExist = await checkDocIdExistsInEs(doc.id)
    if (idExist) {
        return  esClient.update({
            index: `${ELASTIC_SEARCH_INDEX}_documents`,
            id: doc.id,
            body: {
                "script": {
                    "source": `ctx._source=(params.docObj)`,
                    "lang": "painless",
                    "params": {
                      docObj: docObj
                    }
                }
            }
        })
    }else{
      return esClient.index({
        index: `${ELASTIC_SEARCH_INDEX}_documents`,
        body: docObj,
        id: doc.id
      });
    }
}
export async function updateProjectPhaseInDocs(projectId: any,phase: string) {
        let updated = esClient.updateByQuery({
            index: `${ELASTIC_SEARCH_INDEX}_documents`,
            body: {
                "query": { "match": { "projectId": projectId } },
                "script": {
                    "source": "ctx._source.phases=(params.phase)",
                    "lang": "painless",
                    "params": {
                        "phase": phase
                    }
                }
            }
        })
        return updated
}

export async function backgroundJobForDocumentPhases(token:string) {
  const docs:any = await documents.find({ status: { $ne: 0 }, parentId: null, isDeleted: false }).exec()
 
  let docsUpdate = await Promise.all(docs.map(async(doc:any)=>{
    let idExist = await checkDocIdExistsInEs(doc.id)
    if (idExist) {
    let projectDetails = await getProjectDetailsForES(doc.id,token)
    let phases= projectDetails&& projectDetails.phases?projectDetails.phases:[]
    return  esClient.update({
      index: `${ELASTIC_SEARCH_INDEX}_documents`,
      id: doc.id,
      body: {
          "script": {
              "source": `ctx._source.phases=(params.phases)`,
              "lang": "painless",
              "params": {
                phases: phases
              }
          }
        }
    })
  }
  }))
}