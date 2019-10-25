import { documents } from "./model";
import { folders } from "./folder-model";
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

export async function createNewDoc(body: any, userId: any) {
  try {
    if (!body) throw new Error("Unable to create file or file missing")
    const { id: fileId, name: fileName } = body
    let userRoles = await userRoleAndScope(userId);
    let userRole = userRoles.data.global[0];
    const isEligible = await checkRoleScope(userRole, "create-doc");
    if (!isEligible) {
      throw new Error(DOCUMENT_ROUTER.NO_PERMISSION);
    }

    if (!body.name) throw new Error(DOCUMENT_ROUTER.MANDATORY);
    if (body.name.length > configLimit.name) {
      throw new Error("Name " + DOCUMENT_ROUTER.LIMIT_EXCEEDED);
    }
    if (body.description.length > configLimit.description) {
      throw new Error("Description " + DOCUMENT_ROUTER.LIMIT_EXCEEDED);
    }
    body.tags = Array.isArray(body.tags) ? body.tags : body.tags.length ? body.tags.split(",") : []
    let doc = await insertDOC(body, userId, { fileId: fileId, fileName: fileName });
    let role = await groupsAddPolicy(`user/${userId}`, doc.id, "owner");
    if (!role.user) {
      await documents.findByIdAndRemove(doc.id);
      throw new Error(DOCUMENT_ROUTER.CREATE_ROLE_FAIL);
    }
    body.parentId = doc.id;
    let response: any = await insertDOC(body, userId, { fileId: fileId, fileName: fileName });
    return { doc_id: doc.id };
  } catch (err) {
    throw err
  };
};


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
    if (body.name.length > configLimit.name) {
      throw new Error("Name " + DOCUMENT_ROUTER.LIMIT_EXCEEDED);
    }
    if (body.description.length > configLimit.description) {
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
    return { doc_id: doc.id };
  } catch (error) {
    throw error;
  }
}

//  create Document module
async function insertDOC(body: any, userId: string, fileObj?: any) {
  try {
    return await documents.create({
      name: body.name,
      description: body.description || null,
      tags: body.tags,
      versionNum: "1",
      status: fileObj ? STATUS.DONE : STATUS.DRAFT,
      ownerId: userId,
      parentId: body.parentId ? body.parentId : null,
      fileId: fileObj ? fileObj.fileId : null,
      fileName: fileObj ? fileObj.fileName : null
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
      .find({ parentId: null, status: STATUS.PUBLISHED})
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
    let folderList = await folders
      .find({ ownerId: userId },{_id: 0 ,doc_id:1 })
    
    
      let folder_files= folderList.map((folder:any) => {
          return folder.doc_id
        })
        var merged = [].concat.apply([], folder_files);
        console.log(JSON.parse(JSON.stringify(merged)));
        let folderDocIds = JSON.parse(JSON.stringify(merged));
        // let folder_file= folder_files.reduce((main:any,folder:any) => {
        //   console.log(JSON.stringify(folder));
        //   [...main, ...(JSON.stringify(folder))]
        // },[])
        
        // console.log(folder_file);
        
    let docs = await documents
      .find({ ownerId: userId, parentId: null, status: { $ne: STATUS.DRAFT } })
      .sort({ updatedAt: -1 })
    const docList = await Promise.all(
      docs.map(doc => {
          return  docData(doc);
      })
    );
    var result = docList.filter(function(docs){
      return !folderDocIds.some(function(folderDocs:any){
          return docs._id == folderDocs;     
      });
  })
  console.log(result);
    return { docs: result };
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
      documents.find({ parentId: docId }).sort({ createdAt: -1 }).exec(),
      documents.findByIdAndUpdate(docId, { fileId: id, fileName: name }, { new: true }).exec()
    ]);
    if (!child.length) throw new Error(DOCUMENT_ROUTER.CHILD_NOT_FOUND);
    await documents.findByIdAndUpdate(child[0].id, { fileId: id, fileName: name }, { new: true });
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
      if (objBody.name.length > configLimit.name) {
        throw new Error("Name " + DOCUMENT_ROUTER.LIMIT_EXCEEDED);
      }
      obj.name = objBody.name;
    }
    if (objBody.description) {
      if (objBody.description.length > configLimit.description) {
        throw new Error("Description " + DOCUMENT_ROUTER.LIMIT_EXCEEDED);
      }
      obj.description = objBody.description;
    }
    if (objBody.tags) {
      obj.tags = objBody.tags;
    }
    let child: any = await documents.find({ parentId: docId }).sort({ createdAt: -1 }).exec()
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
    hostname: process.env.FILE_SERVICE_HOST,
    port: process.env.FILE_SERVICE_PORT,
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
      username: userName,
      documentName: doc.name,
      documentUrl: `https://cmp-dev.transerve.com/home/resources/doc/${doc._id}`
    })
  });
}
export async function invitePeople(
  docId: string,
  users: object[],
  role: string,
  userId: string
) {
  try {

    if (!docId || !users.length || !role) throw new Error("Missing fields.");
    let doc: any = await documents.findById(docId);
    await Promise.all(
      users.map(async (user: any) => {
        if (doc.ownerId != user._id) return await invite(user, docId, role, doc)
      })
    );
    return { message: "Shared successfully." };
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
            role: (((await userRoleAndScope(user._id)) as any).data.global || [""])[0],
            docRole: (((await getRoleOfDoc(user._id, docId)) as any) ||
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
            role: (((await getRoleOfDoc(group._id, docId)) as any) || Array(2))[2]
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
    if (!Types.ObjectId.isValid(docId)) throw new Error("Given Id is Not Valid")
    let doc: any = await documents.findById(docId);
    if (!doc) throw new Error("Doc Not Found")
    let publishedDoc = await publishedDocCreate({ ...body, status: STATUS.PUBLISHED }, userId, doc, docId)
    let publishedChild = await publishedDocCreate({ ...body, parentId: publishedDoc._id, status: STATUS.DONE }, userId, doc)
    return publishedDoc
  } catch (err) {
    throw err;
  };
};

async function publishedDocCreate(body: any, userId: string, doc: any, docId?: string) {
  try {
    return await documents.create({
      sourceId: docId || null,
      name: body.name,
      description: body.description,
      themes: body.themes || null,
      tags: body.tags || null,
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


export async function unPublished(docId: string) {
  try {
    return await documents.findByIdAndUpdate(
      docId,
      { status: STATUS.UNPUBLISHED },
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

// Get Filterd Documents
export async function docFilter(search: string, userId: string, page: number = 1, limit: number = 30): Promise<object[]> {
  search = search.trim();
  try {
    let docs: any = [],
      shared: any = [];
    //  Search With Tags
    if (search.startsWith("#")) {
      let tags = await Tags.find({ tag: new RegExp(((search.substring(1)).trim()), "i") });
      if (!tags.length) return [];
      let tagId = tags.map(tag => tag._id).pop().toString();
      docs = await documents.find({ tags: { $elemMatch: { $eq: tagId } }, parentId: null }).sort({ updatedAt: -1 });
      shared = await documents.find({ _id: { $in: await GetDocIdsForUser(userId) }, tags: { $elemMatch: { $eq: tagId } } }).sort({ updatedAt: -1 });
    } else {
      //  Search With Tag Names
      docs = await documents.find({ name: new RegExp(search, "i"), parentId: null }).sort({ updatedAt: -1 });
      shared = await documents.find({ _id: { $in: await GetDocIdsForUser(userId) }, name: new RegExp(search, "i") }).sort({ updatedAt: -1 });
    }
    docs = [...(docs.filter((doc: any) => (doc.ownerId == userId && doc.status == STATUS.DONE) || doc.status == STATUS.PUBLISHED || (doc.ownerId == userId && doc.status == STATUS.UNPUBLISHED))), ...shared];
    let filteredDocs = await Promise.all(docs.map((doc: any) => docData(doc)));
    return filterOrdersByPageAndLimit(page, limit, filteredDocs)
  } catch (err) {
    throw err;
  };
};

//  Manual Pagination for Doc Filter
function filterOrdersByPageAndLimit(page: number, limit: number, orders: any): Promise<object[]> {
  let skip = ((page - 1) * limit);
  return orders.slice(skip, skip + limit);
};

export async function createFolder(body: any, userId: string) {
  try {
    let userRoles = await userRoleAndScope(userId);
    let userRole = userRoles.data.global[0];
    const isEligible = await checkRoleScope(userRole, "create-folder");
    if (!isEligible) {
      throw new Error(DOCUMENT_ROUTER.NO_PERMISSION);
    }
    if(!body.name) throw new Error(DOCUMENT_ROUTER.MANDATORY);


    let data = await folders
    .find({ ownerId: userId ,name: body.name});
    if(data.length){
      throw new Error(DOCUMENT_ROUTER.ALREADY_EXIST);
    }  
    let folder = await folders.create({
      name: body.name,
      parentId: body.parentId || null,
      ownerId: userId
    });
    return { folder_id: folder._id }
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function moveToFolder(folderId: string, body: any, userId: string) {
  if(!folderId || (!body.docId && !body.subFolderId)) throw new Error(DOCUMENT_ROUTER.MANDATORY);
  try {
    if(body.docId){
      await folders.update({ _id: folderId }, {
        $push: { doc_id: body.docId }
      })
  }else if(body.subFolderId){
    await folders.update({_id: body.subFolderId }, {
        parentId: folderId 
    })
  }
   return {
      sucess: true
    }
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export async function listFolders(userId: String) {
  try {
    let data = await folders
      .find({ ownerId: userId ,parentId: null})
      .sort({ updatedAt: -1 });
    console.log(data);
    let folderList = data.map((folder: any) => {
      return {
        folderId: folder._id,
        name: folder.name,
        date: folder.createdAt
      }
    })
    return { folders: folderList };
  } catch (error) {
    console.log(error);
    throw error;
  }
}
export async function getFolderDetails(folderId: string, userId: any,page: number = 1, limit: number = 30) {
  if(!folderId) throw new Error(DOCUMENT_ROUTER.MANDATORY);
  const fetchedDoc = await folders.aggregate([
    {
      $match: {
        ownerId: userId,
        $or: [{ _id: Types.ObjectId(folderId) }, { parentId: folderId }]
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
  ]).exec();
  let subfolders = await folders
      .find({ ownerId: userId ,parentId: folderId})
      .sort({ updatedAt: -1 });
  
    let subFolderList = subfolders.map((folder: any) => {
      return {
        folderId: folder._id,
        name: folder.name,
        date: folder.createdAt,
        parentId: folder.parentId
      }
    })
  const docs = await Promise.all(
    fetchedDoc.map((folder: any) => {
      return userData(folder);
    })
  )
  const docsList = docs.map((folder: any) => {
    return folder[0];
  })
  const docsData =  filterOrdersByPageAndLimit(page, limit, docsList)
  return { subFolderList: subFolderList,docsList: docsData };

}

async function userData(folder: any) {
  try {
    
  const data= await Promise.all([{
      docId: folder.doc_id._id,
      name: folder.doc_id.name,
      description: folder.doc_id.description,
      tags: await getTags(folder.doc_id.tags),
      role: (((await userRoleAndScope(folder.doc_id.ownerId)) as any).data.global || [
        ""
      ])[0],
      owner: await userFindOne("id", folder.doc_id.ownerId, { firstName: 1, middleName: 1, lastName: 1, email: 1 }),
      date: folder.doc_id.createdAt
  }])
      return data

  } catch (err) {
    throw err;
  }
}

export async function deleteFolder(folderId: string,userId: string)  {
  try{
    if(!folderId) throw new Error(DOCUMENT_ROUTER.MANDATORY);
    const data = await Promise.all([
      await folders.remove({_id:folderId, ownerId:userId}),
      await folders.update({parentId: folderId}, {
        parentId: null 
    },{"multi": true})
    ])
 
   if(data){
     return {success:true}
   }
   } catch (err) {
     throw err;
   }
 }