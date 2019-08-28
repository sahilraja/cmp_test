import { documents } from "./model"

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
        return { doc_id: response.id, version_id: response.versionId };
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
            versionId: "1",
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
export async function createFile(docId: any, versionId: any, file: any) {
    try {
        if (!docId || !versionId || !file) throw new Error("Missing Fields.");
        //  call to file host for create File

        return { doc_id: docId, version_id: versionId, fileId: "get file id" }
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
        let childDoc: any = await documents.findByIdAndUpdate(docId, { status: status.PENDING }, { new: true });
        return await documents.findByIdAndUpdate(childDoc.parentID, { status: status.PENDING }, { new: true });
    } catch (error) {
        console.log(error);
        throw error;
    };
};

//  Create New Version
export async function createNewVersion(docId: any, userId: any) {
    try {
        if (!docId) throw new Error("DocId Is Missing.");
        let docDetails: any = await documents.findById(docId);
        if (!docDetails) throw new Error("Document Not Exist.")
        let getDocs: any = await documents.find({ parentId: docDetails.parentID }).sort({ "createdAt": -1 })
        let createNewDoc = await documents.create({
            name: docDetails.name,
            description: docDetails.description,
            themes: docDetails.themes,
            tags: docDetails.tags,
            versionId: getDocs[0].versionId + 1,
            status: status.DRAFT,
            ownerId: userId,
            parentId: docDetails.parentID
        })
        return createNewDoc
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
        let parentDoc: any = await documents.findById(docDetails.parentID)
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
        let parentDoc: any = await documents.findByIdAndUpdate(docDetails.parentID, { status: status.APPROVED })
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
        return await documents.findById(docId);
    } catch (err) {
        console.log(err)
        throw err;
    };
};