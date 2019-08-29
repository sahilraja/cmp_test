import { documents } from "./model"
import * as http from "http";
import { Types } from "mongoose";

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
        return { docs: data }
    } catch (error) {
        console.log(error);
        throw error;
    };
};

//  Get My Documents
export async function getDocListOfMe(userid: any) {
    try {
        let data = await documents.find({ parentId: null, ownerId: userid })
        return { docs: data }
    } catch (error) {
        console.log(error);
        throw error;
    };
};

//  Create File
export async function createFile( versionId: any, file: any) {
    try {
        // if (!docId || !versionId || !file) throw new Error("Missing Fields.");
        //  call to file host for create File
       let versionDoc :any=  await documents.findByIdAndUpdate(versionId,{fileId:file.id,fileName:file.fileName},{new:true});
       await documents.findByIdAndUpdate(versionDoc.parentId,{fileId:file.id,fileName:file.fileName},{new:true})

        return {  doc_id:versionDoc.parentId,version_id: versionId }
    } catch (error) {
        console.log(error);
        throw error;
    };
};

//  Submit for approval
export async function submit(docId: any, versionID: any) {
    try {
        if (!docId) {
            throw new Error("missing doc ID");
        }
        let childDoc: any = await documents.findByIdAndUpdate(versionID, { status: status.PENDING }, { new: true });
        return await documents.findByIdAndUpdate(childDoc.parentID, { status: status.PENDING }, { new: true });
    } catch (error) {
        console.log(error);
        throw error;
    };
};

//  Create New Version
export async function createNewVersion(versionID: any, userId: any,obj:any) {
    try {
        if (!versionID) throw new Error("DocId Is Missing.");
        let docDetails: any = await documents.findById(versionID);
        if (!docDetails) throw new Error("Document Not Exist.")
        // let getDocs: any = await documents.find({ parentId: docDetails.parentID }).sort({ "createdAt": -1 })
        let createNewDoc :any= await documents.create({
            name: obj.name,
            description: obj.description,
            themes: obj.themes,
            tags: obj.tags,
            versionNum: docDetails.versionNum + 1,
            status: status.DRAFT,
            ownerId: userId,
            parentId: docDetails.parentId,
            fileName:docDetails.fileName,
            fileId:docDetails.fileId
        })
        return {doc_id:createNewDoc.parentid,versionID:createNewDoc.id}
    } catch (err) {
        console.log(err);
        throw err;
    };
};

//  Reject Document
export async function RejectDoc(docId: any) {
    try {
        if (!docId) throw new Error("Missing DocID.");
        let docDetails: any = await documents.findByIdAndUpdate(docId, { status: status.REJECTED }, { new: true });
        let parentDoc: any = await documents.findById(docDetails.parentId)
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
export async function ApproveDoc(docId: any) {
    try {
        if (!docId) throw new Error("Missing DocID.");
        let docDetails: any = await documents.findByIdAndUpdate(docId, { status: status.APPROVED }, { new: true });
        let parentDoc: any = await documents.findByIdAndUpdate(docDetails.parentId, { status: status.APPROVED })
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
        if (publishDocs.length) throw new Error("Approved Docs Not there.")
        return publishDocs[0]
    } catch (err) {
        console.log(err)
        throw err;
    };
};

export async function getDocumentById(docId : string) : Promise<any> {
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

export async function getDocumentVersionById(versionId : string) : Promise<any> {
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
        return await documents.find({ parentId: docId, versionId: versionId });
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
        let updatedDoc = await documents.findByIdAndUpdate(versionId, obj, { new: true });
        return updatedDoc;
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
        return parentDocList
    } catch (err) {
        console.log(err)
        throw err
    }
}

export async function uploadToFileService(request : any) {
    const options : any= {
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