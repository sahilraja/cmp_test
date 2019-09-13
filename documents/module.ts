import { documents } from "./model"
import * as http from "http";
import { Types, STATES } from "mongoose";
import { userRoleAndScope } from "../role/module";
import { tags } from "../project/tag_model";
import { themes } from "../project/theme_model";
import { groupsAddPolicy, groupsRemovePolicy, GetUserIdsForDocWithRole, GetDocIdsForUser, shareDoc, getRoleOfDoc, GetUserIdsForDoc, GetDocCapabilitiesForUser } from "../utils/groups";
import { Users } from "../users/model";
import { groupsModel } from "../users/group-model";

enum STATUS {
    DRAFT = 0,
    DONE = 1,
    PUBLISHED = 2,
    UNPUBLISHED = 3
}

//  Create Document
export async function createDoc(body: any, userId: string) {
    try {
        if (!body.name) {
            throw new Error("name should be mandatory");
        }
        let doc = await insertDOC(body, userId);
        body.parentId = doc.id;
        let role = await groupsAddPolicy(userId, doc.id, "owner")
        if (!role.user) {
            await documents.findByIdAndRemove(doc.id)
            throw new Error("fail to add role")
        }
        let response: any = await insertDOC(body, userId);
        return { doc_id: doc.id };
    } catch (error) {
        console.log(error);
        throw error;
    };
};

//  create Document module
async function insertDOC(body: any, userId: string) {
    try {
        return await documents.create({
            name: body.name,
            description: body.description,
            tags: body.tags,
            versionNum: "1",
            status: STATUS.DRAFT,
            ownerId: userId,
            parentId: body.parentId ? body.parentId : null
        })
    } catch (error) {
        console.log(error);
        throw error;
    };
};

//  Get Document Public List
export async function getDocList() {
    try {
        let data = await documents.find({ parentId: null, status: STATUS.PUBLISHED });
        if (!data) throw new Error("approved Docs Not There.")
        const docList = await Promise.all(data.map(async doc => {
            const user = { ...doc.toJSON() }
            user.tags = await getTags(user.tags)
            let role: any = await userRoleAndScope(user.ownerId)
            if (!role.data.global) throw new Error(`${user.ownerId} don't Have Role.`)
            user.role = role.data.global[0]
            return user
        }));
        return { docs: docList }
    } catch (error) {
        console.log(error);
        throw error;
    };
};

//  Get My Documents
export async function getDocListOfMe(userId: string) {
    try {
        if (!userId) throw new Error("Missing UserId.");
        let docs = await documents.find({ ownerId: userId, parentId: null, status: { $ne: STATUS.DRAFT } })
        const docList = await Promise.all(docs.map(async doc => {
            const user = { ...doc.toJSON() }
            user.tags = await getTags(user.tags)
            return user
        }))
        return { docs: docList }
    } catch (error) {
        console.log(error);
        throw error;
    };
};

//  Create File
export async function createFile(docId: string, file: any) {
    try {
        const { id, name } = JSON.parse(file)
        if (!id || !name) throw new Error("Missing File Id")
        let [child, parent]: any = await Promise.all([
            documents.find({ parentId: docId }).sort({ createdAt: -1 }).exec(),
            documents.findByIdAndUpdate(docId, { fileId: id, fileName: name }, { new: true }).exec()
        ]);
        if (!child.length) throw new Error("child Doc Not there");
        await documents.findByIdAndUpdate(child[0].id, { fileId: id, fileName: name }, { new: true })
        return { doc_id: docId }
    } catch (error) {
        console.log(error);
        throw error;
    };
};

//  Submit for approval
export async function submit(docId: string) {
    try {
        if (!docId) {
            throw new Error("missing doc ID");
        }
        let [parent, child]: any = await Promise.all([
            documents.findById(docId).exec(),
            documents.find({ parentId: docId }).sort({ createdAt: -1 }).exec()])
        if (!child.length) throw new Error("child Doc Not there")
        child = await documents.findById(child[0].id)
        if (!child.fileId || !parent.fileId) throw new Error("Need to upload file")
        let [childDoc, parentDoc]: any = await Promise.all([
            documents.findByIdAndUpdate(child.id, { status: STATUS.DONE }, { new: true }).exec(),
            documents.findByIdAndUpdate(docId, { status: STATUS.DONE }, { new: true }).exec()
        ]);
        return { docId: docId, fileId: parentDoc.fileId }
    } catch (error) {
        console.log(error);
        throw error;
    };
};

//  Create New Version
export async function createNewVersion(docId: string, versionID: string, userId: any, obj: any) {
    try {
        if (!versionID) throw new Error("DocId Is Missing.");
        let [docDetails, DocList]: any = await Promise.all([
            documents.findOne({ _id: Types.ObjectId(versionID), $or: [{ status: STATUS.APPROVED }, { status: STATUS.REJECTED }] }).exec(),
            documents.find({ parentId: docId }).sort({ "createdAt": -1 }).exec()
        ]);
        if (!docDetails) throw new Error("Document Not Exist.")
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
        })
        return { doc_id: createNewDoc.parentid, versionID: createNewDoc.id }
    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  Reject Document
export async function RejectDoc(docId: string, versionId: string) {
    try {
        if (!docId || !versionId) throw new Error("Missing fields");
        let [child, parentDoc]: any = await Promise.all([
            documents.findByIdAndUpdate(versionId, { status: STATUS.REJECTED }, { new: true }).exec(),
            documents.findById(docId).exec()
        ])
        if (parentDoc.status != STATUS.APPROVED) {
            await documents.findByIdAndUpdate(parentDoc.id, { status: STATUS.REJECTED })
        }
        return { message: "Document Rejected." }
    } catch (err) {
        console.log(err);
        throw err;
    };
};

// Approve Document
export async function ApproveDoc(docId: string, versionId: string) {
    try {
        if (!versionId || !docId) throw new Error("Missing DocID.");
        let [child, parent] = await Promise.all([
            documents.findByIdAndUpdate(versionId, { status: STATUS.APPROVED }, { new: true }).exec(),
            documents.findByIdAndUpdate(docId, { status: STATUS.APPROVED }, { new: true }).exec()
        ]);
        return { message: "Document Approved." }
    } catch (err) {
        console.log(err)
        throw err
    };
};

//  Get Doc Details
export async function getDocDetails(docId: any) {
    try {
        if (!docId) throw new Error("Missing DocID");
        let publishDocs: any = await documents.find({ parentId: docId, status: STATUS.DONE }).sort({ "createdAt": -1 })
        if (!publishDocs.length) throw new Error("Approved Docs Not there.")
        const docList = publishDocs[0].toJSON()
        docList.tags = await getTags(docList.tags)
        docList.themes = await getThemes(docList.themes)
        let role: any = await userRoleAndScope(docList.ownerId)
        docList.role = role.data.global[0]
        return docList
    } catch (err) {
        console.log(err)
        throw err;
    };
};

export async function getDocumentById(docId: string): Promise<any> {
    if (!Types.ObjectId.isValid(docId)) {
        throw new Error('No valid document id given.');
    }
    if (!docId) {
        throw new Error('No document id given.');
    }
    const doc = await documents.findById(docId);
    if (!doc) {
        throw new Error("No document found with given id");
    }
    return doc;
}

export async function getDocumentVersionById(versionId: string): Promise<any> {
    if (!versionId) {
        throw new Error('No document id given.');
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
        const docList = docDetails.toJSON()
        docList.tags = await getTags(docList.tags)
        docList.themes = await getThemes(docList.themes)
        let role: any = await userRoleAndScope(docList.ownerId)
        docList.role = role.data.global[0]
        return docList
    } catch (err) {
        console.log(err);
        throw err;
    };
};

export async function updateDoc(objBody: any, docId: any) {
    try {
        let obj: any = {};
        if (objBody.name) {
            obj.name = objBody.name;
        };
        if (objBody.description) {
            obj.description = objBody.description;
        };
        if (objBody.tags) {
            obj.tags = objBody.tags;
        };
        let [parent, child]: any = await Promise.all([
            documents.findByIdAndUpdate(docId, obj, { new: true }).exec(),
            documents.find({ parentId: docId }).sort({ createdAt: -1 }).exec()
        ])
        if (!child.length) throw new Error("Versions Not Found.")
        await documents.create({
            name: parent.name,
            description: parent.description,
            tags: parent.tags,
            versionNum: Number(child[0].versionNum) + 1,
            status: parent.status,
            ownerId: parent.userId,
            parentId: parent.id,
            fileId: parent.fileId,
            fileName: parent.fileName
        })
        return parent;
    } catch (err) {
        console.log(err);
        throw err;
    };
};

export async function approvalList() {
    try {
        let docList = await documents.find({ parentId: { $ne: null }, status: STATUS.PENDING });
        let parentDocsIdsArray = docList.map((doc: any) => { return doc.parentId })
        let parentDocList = await documents.find({ _id: { $in: parentDocsIdsArray } })
        const List = await Promise.all(parentDocList.map(async doc => {
            const user = { ...doc.toJSON() }
            user.tags = await getTags(user.tags)
            return user
        }))
        return List
    } catch (err) {
        console.log(err)
        throw err
    }
}

export async function uploadToFileService(request: any) {
    const options: any = {
        hostname: 'localhost',
        port: 4040,
        path: '/files',
        method: 'POST',
        headers: request.headers
    };
    return new Promise((resolve, reject) => {


        const req = http.request(options, res => {
            // response.writeHead(200, res.headers);
            res.setEncoding('utf8');
            let content = '';
            res.on('data', (chunk) => {
                content += chunk;
            });
            res.on('end', () => {
                resolve(content);
            });
        });
        req.on('error', (e) => {
            console.error(e);
        });
        request.pipe(req);
    });
}

export async function getVersions(docId: string) {
    try {
        if (!docId) throw new Error("Missing Doc ID")
        let docVersions = await documents.find({ parentId: docId, status: { $ne: STATUS.DRAFT } }, { versionNum: 1, status: 1, createdAt: 1, updatedAt: 1 }).sort({ createdAt: -1 })
        if (!docVersions.length) throw new Error("Docs Not there")
        return docVersions
    } catch (error) {
        console.log(error)
        throw error
    }
}

export async function getApprovalDoc(docId: string) {
    try {
        if (!docId) throw new Error("Missing docId");
        let [parent, pendingDoc]: any = await Promise.all([
            documents.findById(docId).exec(),
            documents.find({ parentId: docId, status: STATUS.PENDING }).sort({ createdAt: -1 }).exec()])
        const parentDoc = parent.toJSON()
        parentDoc.tags = await getTags(parentDoc.tags)
        parentDoc.themes = await getThemes(parentDoc.themes)
        let parentRole: any = await userRoleAndScope(parentDoc.ownerId)
        parentDoc.role = parentRole.data.global[0]
        const modifiedDoc = pendingDoc[0].toJSON()
        modifiedDoc.tags = await getTags(modifiedDoc.tags)
        modifiedDoc.themes = await getThemes(modifiedDoc.themes)
        let modifiedRole: any = await userRoleAndScope(parentDoc.ownerId)
        parentDoc.role = modifiedRole.data.global[0]


    } catch (err) {
        console.log(err)
        throw err
    }
}

async function getTags(tagIds: any[]) {
    try {
        return await tags.find({ _id: { $in: tagIds } }, { tag: 1 })
    } catch (err) {
        console.log(err)
        throw err
    };
};

async function getThemes(themeIds: any[]) {
    try {
        return await themes.find({ _id: { $in: themeIds } }, { theme: 1 })
    } catch (err) {
        console.log(err)
        throw err
    };
};

//  Add Collaborator
export async function addCollaborator(docId: string, collaborators: string[]) {
    try {
        if (!Types.ObjectId.isValid(docId)) throw new Error("Given id not Valid");
        if (!Array.isArray(collaborators)) throw new Error("Missing Collaborators.")
        await Promise.all([collaborators.map(async (user: string) => {
            let success = await groupsAddPolicy(user, docId, "collaborator")
            if (!success.user) throw new Error(`${user} have already these permissions`)
        })])
        return { message: "added collaborators successfully." }
    } catch (err) {
        throw err
    };
};

//  remove Collaborator
export async function removeCollaborator(docId: string, collaborators: string[]) {
    try {
        if (!Types.ObjectId.isValid(docId)) throw new Error("Given id not Valid");
        if (!Array.isArray(collaborators)) throw new Error("Missing Collaborators.")
        await Promise.all([collaborators.map(async (user: string) => {
            let success = await groupsRemovePolicy(user, docId, "collaborator")
            if (!success.user) throw new Error(`${user} don't have these permissions`)
        })])
        return { message: "Remove collaborators successfully." }
    } catch (err) {
        throw err
    };
};

//  Add Viewers
export async function addViewers(docId: string, viewers: string[]) {
    try {
        if (!Types.ObjectId.isValid(docId)) throw new Error("Given id not Valid");
        if (!Array.isArray(viewers)) throw new Error("Missing viewers.")
        await Promise.all([viewers.map(async (user: string) => {
            let success = await groupsAddPolicy(user, docId, "viewer")
            if (!success.user) throw new Error(`${user} have already these permissions`)
        })])
        return { message: "added viewers successfully." }
    } catch (err) {
        throw err
    };
};

//  remove Viewers
export async function removeViewers(docId: string, viewers: string[]) {
    try {
        if (!Types.ObjectId.isValid(docId)) throw new Error("Given id not Valid");
        if (!Array.isArray(viewers)) throw new Error("Missing viewers.")
        await Promise.all([viewers.map(async (user: string) => {
            let success = await groupsRemovePolicy(user, docId, "viewer")
            if (!success.user) throw new Error(`${user} don't have these permissions`)
        })])
        return { message: "remove viewers successfully." }
    } catch (err) {
        throw err
    };
};

export async function collaboratorList(docId: string) {
    try {
        let users = await GetUserIdsForDocWithRole(docId, "collaborator")
        return await Users.find({ _id: { $in: users } }, { firstName: 1, secondName: 1, email: 1 })
    } catch (err) {
        throw err
    };
};

export async function viewerList(docId: string) {
    try {
        let users = await GetUserIdsForDocWithRole(docId, "viewer")
        return await Users.find({ _id: { $in: users } }, { firstName: 1, secondName: 1, email: 1 })
    } catch (err) {
        throw err
    };
};

export async function sharedList(userId: string) {
    try {
        let docIds = await GetDocIdsForUser(userId)
        return await documents.find({ _id: { $in: docIds } })
    } catch (err) {
        throw err
    };
};

export async function invitePeople(docId: string, users: object[], role: string) {
    try {
        if (!docId || !users || !role) throw new Error("Missing fields.");
        Promise.all([users.map(async (user: any) => {
            await shareDoc(user.id, user.type, docId, role)
        })])
        return { message: "added successfully." }
    } catch (err) {
        throw err
    };
};

export async function invitePeopleEdit(docId: string, userId: string, type: string, role: string) {
    try {
        if (!docId || !userId || !type || !role) throw new Error("Missing fields.");
        let userRole: any = await getRoleOfDoc(userId, docId);
        await groupsRemovePolicy(`${type}/${userId}`, docId, userRole[2])
        await await groupsAddPolicy(`${type}/${userId}`, docId, role)
        return { message: "add successfully." }
    } catch (err) {
        throw err
    };
};

export async function invitePeopleRemove(docId: string, userId: string, type: string, role: string) {
    try {
        if (!docId || !userId || !type || !role) throw new Error("Missing fields.");
        await groupsRemovePolicy(`${type}/${userId}`, docId, role)
        return { message: "Remove successfully." }
    } catch (err) {
        throw err
    };
};

export async function invitePeopleList(docId: string) {
    try {
        if (!Types.ObjectId.isValid(docId)) throw new Error("Given id not Valid");
        let users = await GetUserIdsForDoc(docId)
        if (!users) throw new Error("fail to fetch user id.")
        let userGroup: any = {}
        users.map((user: any) => {
            if (userGroup[user.split("/")[0]]) {
                userGroup[user.split("/")[0]].push(user.split("/")[1])
            } else {
                userGroup[user.split("/")[0]] = [user.split("/")[1]]
            }
        })
        if (userGroup.user) {
            var userData: any = await Users.find({ _id: { $in: userGroup.user } }, { firstName: 1, secondName: 1, email: 1 })
            userData = await Promise.all([userData.map(async (user: any) => {
                return {
                    name: user.firstName + " " + user.secondName,
                    type: "user",
                    email: user.email,
                    role: ((await getRoleOfDoc(user.id, docId)) as any)[2]
                }
            })])
        }
        if (userGroup.group) {
            var groupData: any = await groupsModel.find({ _id: { $in: userGroup.group } }, { name: 1 })
            groupData = await Promise.all([groupData.map(async (user: any) => {
                return {
                    name: name,
                    type: "group",
                    email: "N/A",
                    role: ((await getRoleOfDoc(user.id, docId)) as any)[2]
                }
            })])
        }
        return [...userData, ...groupData]
    } catch (err) {
        throw err;
    };
};

export async function docCapabilities(docId: string, userId: string) {
    try {
        return await GetDocCapabilitiesForUser(userId, docId)
    } catch (err) {
        throw err
    };
};

export async function published(docId: string, userId: string) {
    try {
        let doc: any = await documents.findById(docId)
        return await documents.create(
            {
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
            }
        )

    } catch (err) {
        throw err
    }
}

export async function unPublished(docId: string) {
    try {
        return await documents.findByIdAndUpdate(docId, { status: STATES.UNPUBLISHED }, { new: true })
    } catch (err) {
        throw err
    }
}

export async function replaceDoc(docId: string, replaceDoc: string, userId: string) {
    try {
        let [doc, unPublished]: any = await Promise.all([
            documents.findById(replaceDoc).exec(),
            documents.findByIdAndUpdate(docId, { status: STATES.UNPUBLISHED }, { new: true }).exec()
        ])
        return await documents.create(
            {
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
            }
        )

    } catch (err) {
        throw err
    };
};

export async function publishList(userId: string) {
    try {
        return await documents.find({ ownerId: userId, status: STATUS.PUBLISHED })
    } catch (err) {
        throw err
    }
}