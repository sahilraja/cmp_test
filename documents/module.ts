import { documents } from "./model";
import * as http from "http";
import { Types, STATES } from "mongoose";
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
  checkCapability
} from "../utils/groups";
import { nodemail } from "../utils/email";
import { docInvitePeople } from "../utils/email_template";
import { DOCUMENT_ROUTER } from "../utils/error_msg";
import { userFindOne, userFindMany, userList, listGroup } from "../utils/users";
import { checkRoleScope } from '../utils/role_management'
import { configLimit } from '../utils/systemconfig'

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

//  Create Document
export async function createDoc(body: any, userId: string) {
  try {
    let userRoles = await userRoleAndScope(userId);

    let userRole = userRoles.data.global[0];
    const isEligible = await checkRoleScope(userRole, "create-doc");
    if (!isEligible) {
      throw new Error(DOCUMENT_ROUTER.NO_PERMISSION);
    }
    if (!body.name) throw new Error(DOCUMENT_ROUTER.MANDATORY);
    if(body.name.length > configLimit.name) {
      throw new Error("Name "+ DOCUMENT_ROUTER.LIMIT_EXCEEDED);
    }
    if(body.description.length > configLimit.description) {
      throw new Error("Description "+ DOCUMENT_ROUTER.LIMIT_EXCEEDED);
    }
    let doc = await insertDOC(body, userId);
    body.parentId = doc.id;
    let role = await groupsAddPolicy(`user/${userId}`, doc.id, "owner");
    if (!role.user) {
      await documents.findByIdAndRemove(doc.id);
      throw new Error(DOCUMENT_ROUTER.CREATE_ROLE_FAIL);
    }
    let response: any = await insertDOC(body, userId);
    return { doc_id: doc.id };
  } catch (error) {
    throw error;
  }
}

//  create Document module
async function insertDOC(body: any, userId: string) {
  try {
    return await documents.create({
      name: body.name,
      description: body.description || null,
      tags: body.tags,
      versionNum: "1",
      status: STATUS.DRAFT,
      ownerId: userId,
      parentId: body.parentId ? body.parentId : null
    });
  } catch (error) {
    console.log(error);
    throw error;
  }
}

//  Get Document Public List
export async function getDocList() {
  try {
    let data = await documents
      .find({ parentId: null, status: STATUS.PUBLISHED })
      .sort({ updatedAt: -1 });
    const docList = await Promise.all(
      data.map(async doc => {
        return await docData(doc);
      })
    );
    return { docs: docList };
  } catch (error) {
    console.log(error);
    throw error;
  }
}

async function docData(docData: any) {
  try {
    return {
      ...docData.toJSON(),
      tags: await getTags(docData.tags),
      role: (((await userRoleAndScope(docData.ownerId)) as any).data.global || [
        ""
      ])[0],
      owner: await userFindOne("id", docData.ownerId, { name: 1 })
    };
  } catch (err) {
    throw err;
  }
}

//  Get My Documents
export async function getDocListOfMe(userId: string) {
  try {
    let docs = await documents
      .find({ ownerId: userId, parentId: null, status: { $ne: STATUS.DRAFT } })
      .sort({ updatedAt: -1 });
    const docList = await Promise.all(
      docs.map(async doc => {
        return await docData(doc);
      })
    );
    return { docs: docList };
  } catch (error) {
    console.log(error);
    throw error;
  }
}

//  Create File
export async function createFile(docId: string, file: any) {
  try {
    if (!Types.ObjectId.isValid(docId))
      throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID);
    const { id, name } = JSON.parse(file);
    if (!id || !name) throw new Error(DOCUMENT_ROUTER.MANDATORY);
    let [child, parent]: any = await Promise.all([
      documents
        .find({ parentId: docId })
        .sort({ createdAt: -1 })
        .exec(),
      documents
        .findByIdAndUpdate(docId, { fileId: id, fileName: name }, { new: true })
        .exec()
    ]);
    if (!child.length) throw new Error(DOCUMENT_ROUTER.CHILD_NOT_FOUND);
    await documents.findByIdAndUpdate(
      child[0].id,
      { fileId: id, fileName: name },
      { new: true }
    );
    return { doc_id: docId };
  } catch (error) {
    console.log(error);
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
        .find({ parentId: docId })
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
    console.log(error);
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
    console.log(err);
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
    console.log(err);
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
    console.log(err);
    throw err;
  }
}

//  Get Doc Details
export async function getDocDetails(docId: any) {
  try {
    if (!Types.ObjectId.isValid(docId))
      throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID);
    let publishDocs: any = await documents.findById(docId);
    const docList = publishDocs.toJSON();
    docList.tags = await getTags(docList.tags);
    docList.role = ((await userRoleAndScope(
      docList.ownerId
    )) as any).data.global[0];
    docList.owner = await userFindOne("id", docList.ownerId, {
      firstName: 1,
      lastName: 1,
      middleName: 1,
      email: 1
    });
    return docList;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

export async function getDocumentById(docId: string): Promise<any> {
  if (!Types.ObjectId.isValid(docId))
    throw new Error(DOCUMENT_ROUTER.DOCID_NOT_VALID);
  return await documents.findById(docId);
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
    docList.role = role.data.global[0];
    return docList;
  } catch (err) {
    console.log(err);
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
      obj.name = objBody.name;
    }
    if (objBody.description) {
      obj.description = objBody.description;
    }
    if (objBody.tags) {
      obj.tags = objBody.tags;
    }
    let [parent, child]: any = await Promise.all([
      documents.findByIdAndUpdate(docId, obj, { new: true }).exec(),
      documents
        .find({ parentId: docId })
        .sort({ createdAt: -1 })
        .exec()
    ]);
    if (!child.length) throw new Error(DOCUMENT_ROUTER.CHILD_NOT_FOUND);
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
    });
    return parent;
  } catch (err) {
    console.log(err);
    throw err;
  }
}

export async function approvalList() {
  try {
    let docList = await documents
      .find({ parentId: { $ne: null }, status: STATUS.PUBLISHED })
      .sort({ updatedAt: -1 });
    let parentDocsIdsArray = docList.map((doc: any) => {
      return doc.parentId;
    });
    let parentDocList = await documents.find({
      _id: { $in: parentDocsIdsArray }
    });
    return await Promise.all(
      parentDocList.map(async doc => {
        return await docData(doc);
      })
    );
  } catch (err) {
    console.log(err);
    throw err;
  }
}

export async function uploadToFileService(request: any) {
  const options: any = {
    hostname: "localhost",
    port: 4040,
    path: "/files",
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
    if (!docId) throw new Error("Missing Doc ID");
    let docVersions = await documents
      .find(
        { parentId: docId, status: { $ne: STATUS.DRAFT } },
        { versionNum: 1, status: 1, createdAt: 1, updatedAt: 1 }
      )
      .sort({ createdAt: -1 });
    if (!docVersions.length) throw new Error("Docs Not there");
    return docVersions;
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function getApprovalDoc(docId: string) {
  try {
    if (!docId) throw new Error("Missing docId");
    let [parent, pendingDoc]: any = await Promise.all([
      documents.findById(docId).exec(),
      documents
        .find({ parentId: docId, status: STATUS.PENDING })
        .sort({ createdAt: -1 })
        .exec()
    ]);
    const parentDoc = parent.toJSON();
    parentDoc.tags = await getTags(parentDoc.tags);
    parentDoc.themes = await getThemes(parentDoc.themes);
    let parentRole: any = await userRoleAndScope(parentDoc.ownerId);
    parentDoc.role = parentRole.data.global[0];
    const modifiedDoc = pendingDoc[0].toJSON();
    modifiedDoc.tags = await getTags(modifiedDoc.tags);
    modifiedDoc.themes = await getThemes(modifiedDoc.themes);
    let modifiedRole: any = await userRoleAndScope(parentDoc.ownerId);
    parentDoc.role = modifiedRole.data.global[0];
  } catch (err) {
    console.log(err);
    throw err;
  }
}

async function getTags(tagIds: any[]) {
  try {
    return await Tags.find({ _id: { $in: tagIds } }, { tag: 1 });
  } catch (err) {
    console.log(err);
    throw err;
  }
}

async function getThemes(themeIds: any[]) {
  try {
    return await themes.find({ _id: { $in: themeIds } }, { theme: 1 });
  } catch (err) {
    console.log(err);
    throw err;
  }
}

//  Add Collaborator
export async function addCollaborator(docId: string, collaborators: string[]) {
  try {
    if (!Types.ObjectId.isValid(docId)) throw new Error("Given id not Valid");
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
    return await userList({ _id: { $in: users } }, { firstName: 1,middleName:1,lastName:1, email: 1 });
  } catch (err) {
    throw err;
  }
}

export async function viewerList(docId: string) {
  try {
    let users = await GetUserIdsForDocWithRole(docId, "viewer");
    return await userList({ _id: { $in: users } }, { firstName: 1,middleName:1,lastName:1, email: 1 });
  } catch (err) {
    throw err;
  }
}

export async function sharedList(userId: string) {
  try {
    let docIds = await GetDocIdsForUser(userId);
    let docs = await documents
      .find({ _id: { $in: docIds } })
      .sort({ updatedAt: -1 });
    return await Promise.all(
      docs.map(async (doc: any) => {
        return await docData(doc);
      })
    );
  } catch (err) {
    throw err;
  }
}

async function invite(user: any, docId: any, role: any, doc: any) {
  await shareDoc(user._id, user.type, docId, role);
  let userData: any = await userFindOne("id", user._id);
  let userName = `${userData.firstName} ${userData.middleName || ""} ${userData.lastName || ""}`;
  return nodemail({
    email: userData.email,
    subject: `Invitation for ${doc.name} document`,
    html: docInvitePeople({
      username: userData.name,
      documentName: doc.name,
      documentUrl: `https://cmp-dev.transerve.com/home/resources/doc/${doc._id}`
    })
  });
}
export async function invitePeople(
  docId: string,
  users: object[],
  role: string
) {
  try {
    if (!docId || !users || !role) throw new Error("Missing fields.");
    let doc: any = await documents.findById(docId);
    await Promise.all(
      users.map(async (user: any) => await invite(user, docId, role, doc))
    );
    return { message: "Share successfully." };
  } catch (err) {
    throw err;
  }
}

export async function invitePeopleEdit(
  docId: string,
  userId: string,
  type: string,
  role: string
) {
  try {
    if (!docId || !userId || !type || !role) throw new Error("Missing fields.");
    let userRole: any = await getRoleOfDoc(userId, docId);
    await groupsRemovePolicy(`${type}/${userId}`, docId, userRole[2]);
    await groupsAddPolicy(`${type}/${userId}`, docId, role);
    return { message: "Edit user successfully." };
  } catch (err) {
    throw err;
  }
}

export async function invitePeopleRemove(
  docId: string,
  userId: string,
  type: string,
  role: string
) {
  try {
    if (!docId || !userId || !type || !role) throw new Error("Missing fields.");
    await groupsRemovePolicy(`${type}/${userId}`, docId, role);
    return { message: "Revoke share successfully." };
  } catch (err) {
    throw err;
  }
}

export async function invitePeopleList(docId: string) {
  try {
    if (!Types.ObjectId.isValid(docId)) throw new Error("Given id not Valid");
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
        { firstName: 1, middleName:1,lastName:1, email: 1 }
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
            role: (((await getRoleOfDoc(user._id, docId)) as any) ||
              Array(2))[2]
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
            name: name,
            type: "group",
            email: "N/A",
            role: ((await getRoleOfDoc(group.id, docId)) as any)[2]
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

export async function published(body: any, docId: string, userId: string) {
  try {
    let doc: any = await documents.findById(docId);
    return await documents.create({
      sourceId: docId,
      name: body.name,
      description: body.description,
      themes: body.themes || null,
      tags: body.tags || null,
      versionNum: 1,
      status: STATUS.PUBLISHED,
      ownerId: userId,
      fileName: body.fileName || doc.fileName,
      fileId: body.fileId || doc.fileId
    });
  } catch (err) {
    throw err;
  }
}

export async function unPublished(docId: string) {
  try {
    return await documents.findByIdAndUpdate(
      docId,
      { status: STATES.UNPUBLISHED },
      { new: true }
    );
  } catch (err) {
    throw err;
  }
}

export async function replaceDoc(
  docId: string,
  replaceDoc: string,
  userId: string
) {
  try {
    let [doc, unPublished]: any = await Promise.all([
      documents.findById(replaceDoc).exec(),
      documents
        .findByIdAndUpdate(docId, { status: STATES.UNPUBLISHED }, { new: true })
        .exec()
    ]);

    return await documents.create({
      name: doc.name,
      description: doc.description,
      themes: doc.themes,
      tags: doc.tags,
      versionNum: 1,
      status: STATUS.PUBLISHED,
      ownerId: userId,
      parentId: doc.parentId,
      fileName: doc.fileName,
      fileId: doc.fileId
    });
  } catch (err) {
    throw err;
  }
}

export async function publishList(userId: string) {
  try {
    let docs = await documents
      .find({ ownerId: userId, status: STATUS.PUBLISHED })
      .sort({ updatedAt: -1 });
    return await Promise.all(
      docs.map(async (doc: any) => {
        return await docData(doc);
      })
    );
  } catch (err) {
    throw err;
  }
}

export async function docFilter(search: string, userId: string) {
  search = search.trim();
  try {
    let docs: any = [],
      shared: any = [];
    if (search.startsWith("#")) {
      let tags = await Tags.find({ tag: new RegExp(search.substring(1), "i") });
      if (!tags.length) return [];
      let tagId = tags
        .map(tag => tag._id)
        .pop()
        .toString();
      docs = await documents
        .find({ tags: { $elemMatch: { $eq: tagId } }, parentId: null })
        .sort({ updatedAt: -1 })
        .limit(30);
      shared = await documents
        .find({
          _id: { $in: await GetDocIdsForUser(userId) },
          tags: { $elemMatch: { $eq: tagId } }
        })
        .sort({ updatedAt: -1 });
    } else {
      docs = await documents
        .find({ name: new RegExp(search, "i"), parentId: null })
        .sort({ updatedAt: -1 })
        .limit(30);
      shared = await documents
        .find({
          _id: { $in: await GetDocIdsForUser(userId) },
          name: new RegExp(search, "i")
        })
        .sort({ updatedAt: -1 });
    }
    docs = [
      ...docs.filter(
        (doc: any) =>
          (doc.ownerId == userId && doc.status == STATUS.DONE) ||
          doc.status == STATUS.PUBLISHED
      ),
      ...shared
    ];
    return await Promise.all(
      docs.map(async (doc: any) => {
        return await docData(doc);
      })
    );
  } catch (err) {
    throw err;
  }
}
