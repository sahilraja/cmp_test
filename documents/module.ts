import { documents } from "./model"

enum status {
    DRAFT = 0,
    PUBLISHED = 1,
    PENDING = 2,
    APPROVED = 3
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
        let data = await documents.find({ parentId: null, status: status.PUBLISHED });
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