import { documents } from "./model"
import * as http from "http";
import { Types } from "mongoose";
import { MISSING } from "../utils/error_msg";
import { userRoleAndScope } from "../role/module";
import { tags } from "../project/tag_model";
import { themes } from "../project/theme_model";


enum status {
    DRAFT = 0,
    APPROVED = 1,
    REJECTED = 2,
    PENDING = 3
}

//  Create Document
export async function createDOC(body: any, userID: any) {
    try {
        if (!body.name) {
            throw new Error("name should be mandatory");
        }
        let doc = await insertDOC(body, userID);
        body.parentID = doc.id;
        let response: any = await insertDOC(body, userID);
        return { doc_id: doc.id, version_id: response.id };
    } catch (error) {
        console.log(error);
        throw error;
    };
};

//  create Document module
async function insertDOC(body: any, userID: any) {
    try {
        return await documents.create({
            name: body.name,
            description: body.description,
            themes: body.themes,
            tags: body.tags,
            versionNum: "1",
            status: status.DRAFT,
            ownerId: userID,
            parentId: body.parentID ? body.parentID : null
        })
    } catch (error) {
        console.log(error);
        throw error;
    };
};

//  Get Document Public List
export async function getDocList() {
    try {
        let data = await documents.find({ parentId: null, status: status.APPROVED });
        const docList = await Promise.all(data.map(async doc => {
            const user = { ...doc.toJSON() }
            user.tags = await getTags(user.tags)
            user.role = (await userRoleAndScope(user.ownerId)).data[0].role
            return user
        }))

        return { docs: docList }
    } catch (error) {
        console.log(error);
        throw error;
    };
};

//  Get My Documents
export async function getDocListOfMe(userid: any) {
    try {
        let data = await documents.find({ parentId: null, ownerId: userid, status: { $ne: status.DRAFT } })
        const docList = await Promise.all(data.map(async doc => {
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
export async function createFile(docId: string, versionId: string, file: any) {
    try {
        const { id, name } = JSON.parse(file)
        if (!id || !name) throw new Error("Missing File Id")
        let [child, parent]: any = await Promise.all([
            documents.findByIdAndUpdate(versionId, { fileId: id, fileName: name }, { new: true }).exec(),
            documents.findByIdAndUpdate(docId, { fileId: id, fileName: name }, { new: true }).exec()
        ]);
        return { doc_id: docId, version_id: versionId }
    } catch (error) {
        console.log(error);
        throw error;
    };
};

//  Submit for approval
export async function submit(docId: any, versionId: any) {
    try {
        if (!docId) {
            throw new Error("missing doc ID");
        }
        let [parent, child]: any = await Promise.all([
            documents.findById(docId).exec(),
            documents.findById(versionId).exec()])
        if (!child.fileId || !parent.fileId) throw new Error("Need to upload file")
        let childDoc: any = await documents.findByIdAndUpdate(versionId, { status: status.PENDING }, { new: true });
        let parentDoc: any = await documents.findByIdAndUpdate(childDoc.parentId, { status: status.PENDING }, { new: true });
        return { docId: docId, versionId: versionId, fileId: parentDoc.fileId }
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
            documents.findOne({ _id: Types.ObjectId(versionID), $or: [{ status: status.APPROVED }, { status: status.REJECTED }] }).exec(),
            documents.find({ parentId: docId }).sort({ "createdAt": -1 }).exec()
        ]);
        if (!docDetails) throw new Error("Document Not Exist.")
        let createNewDoc: any = await documents.create({
            name: obj.name,
            description: obj.description,
            themes: obj.themes,
            tags: obj.tags,
            versionNum: Number(DocList[0].versionNum) + 1,
            status: status.DRAFT,
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
            documents.findByIdAndUpdate(versionId, { status: status.REJECTED }, { new: true }).exec(),
            documents.findById(docId).exec()
        ])
        if (parentDoc.status != status.APPROVED) {
            await documents.findByIdAndUpdate(parentDoc.id, { status: status.REJECTED })
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
            documents.findByIdAndUpdate(versionId, { status: status.APPROVED }, { new: true }).exec(),
            documents.findByIdAndUpdate(docId, { status: status.APPROVED }, { new: true }).exec()
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
        let publishDocs: any = await documents.find({ parentId: docId, status: status.APPROVED }).sort({ "createdAt": -1 })
        if (!publishDocs.length) throw new Error("Approved Docs Not there.")
        const docList = publishDocs[0].toJSON()
        docList.tags = await getTags(docList.tags)
        docList.themes = await getThemes(docList.themes)
        docList.role = (await userRoleAndScope(docList.ownerId)).data[0].role
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
        docList.role = (await userRoleAndScope(docList.ownerId)).data[0].role
        return docList
    } catch (err) {
        console.log(err);
        throw err;
    };
};

export async function updateDoc(objBody: any, docid: any, versionId: any) {
    try {
        let obj: any = {};
        if (objBody.name) {
            obj.name = objBody.name;
        };
        if (objBody.description) {
            obj.description = objBody.description;
        };
        if (objBody.themes) {
            obj.themes = objBody.themes;
        };
        if (objBody.tags) {
            obj.tags = objBody.tags;
        };
        let [child, parent]: any = await Promise.all([
            documents.findByIdAndUpdate(versionId, obj, { new: true }).exec(),
            documents.findById(docid).exec()
        ])
        if (parent.status != status.APPROVED) {
            await documents.findByIdAndUpdate(docid, obj, { new: true })
        }
        return child;
    } catch (err) {
        console.log(err);
        throw err;
    };
};

export async function approvalList() {
    try {
        let docList = await documents.find({ parentId: { $ne: null }, status: status.PENDING });
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
        let docVersions = await documents.find({ parentId: docId, status: { $ne: status.DRAFT } }, { versionNum: 1, status: 1, createdAt: 1, updatedAt: 1 }).sort({ createdAt: -1 })
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
            documents.find({ parentId: docId, status: status.PENDING }).sort({ createdAt: -1 }).exec()])
        const parentDoc = parent.toJSON()
        parentDoc.tags = await getTags(parentDoc.tags)
        parentDoc.themes = await getThemes(parentDoc.themes)
        parentDoc.role = (await userRoleAndScope(parentDoc.ownerId)).data[0].role
        const modifiedDoc = pendingDoc[0].toJSON()
        modifiedDoc.tags = await getTags(modifiedDoc.tags)
        modifiedDoc.themes = await getThemes(modifiedDoc.themes)
        modifiedDoc.role = (await userRoleAndScope(modifiedDoc.ownerId)).data[0].role
        if(parentDoc.status == status.PENDING){
            return{original: parentDoc}
        }
        else{
            return { original: parentDoc, modified: modifiedDoc }
        }

        
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
    }
}