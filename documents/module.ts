import {documents} from "./model"
enum status  {
PUBLISHED = 0,
PENDING = 1,
APPROVED = 2
}
export async function createDOC(body:any,userID:any){

try {
    if(!body.name){
        throw new Error("name should be mandatory")
    }
    let doc = await insertDOC(body,userID)
    body.parentID = doc.id
    let response = await insertDOC(body,userID)
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
            status:status.PENDING,
            ownerId:userID,
            parentId:body.parentID?body.parentID:null
          }) 
    } catch (error) {
        console.log(error)
        throw error
    }
    
}