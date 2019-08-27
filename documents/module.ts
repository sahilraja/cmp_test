import {documents} from "./model"
enum status  {
    DRAFT =0,
PUBLISHED = 1,
PENDING = 2,
APPROVED = 3
}
export async function createDOC(body:any,userID:any){

try {
    if(!body.name){
        throw new Error("name should be mandatory")
    }
    let doc = await insertDOC(body,userID)
    body.parentID = doc.id
    let response:any = await insertDOC(body,userID)
    return {doc_id:response.id,version_id:response.versionId}
} catch (error) {
    console.log(error)
    throw error
}
    

}

async function insertDOC(body:any,userID:any){
    try {
        return await documents.create({
            name:body.name,
            description:body.description,
            themes:body.themes,
            tags:body.tags,
            versionId:"1",
            status:status.DRAFT,
            ownerId:userID,
            parentId:body.parentID?body.parentID:null
          }) 
    } catch (error) {
        console.log(error)
        throw error
    }
    
}

export async function submit(docId:any,versionID:any){
    try {
        if(!docId){
            throw new Error("missing doc ID")
        }
        let childDoc:any = await documents.findByIdAndUpdate(docId, {status: status.PENDING}, {new : true})
        return  await documents.findByIdAndUpdate(childDoc.parentID,{status:status.PENDING},{new:true})
        
    } catch (error) {
        console.log(error)
        throw error
    }

}