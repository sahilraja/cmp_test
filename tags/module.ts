import { tags } from "./tag_model";
import { documents } from "../documents/model"
const MESSAGE_URL = process.env.MESSAGE_URL || "http://localhost:4001";
const TASK_URL = process.env.TASK_HOST || "http://localhost:5052";
import { checkRoleScope } from '../utils/role_management' ;
import { userRoleAndScope } from "../role/module";
import * as request from "request-promise";
import { APIError } from "../utils/custom-error";
import { create } from "../log/module";


//  get list of tags
export async function tag_list(search: string) {
  try {
    let success = await tags.find({ tag: new RegExp(search, "i"), is_active: true, deleted:false });
    return { status: true, data: success }
  } catch (err) {
    console.error(err);
    throw err;
  }
}

//  get list of tags
export async function mergeTags(body: any, token: string, userId:string) {
  try {
    let userRoles = await userRoleAndScope(userId);
    let userRole = userRoles.data[0];
    const isEligible = await checkRoleScope(userRole, "merge-tag");
    if (!isEligible) {
      throw new APIError("Unauhorized Action", 403);
    }
    let mergeTagId:any;
    if(!body.tags ||!body.mergeTag) throw new Error("All Mandatory Fields Required")
    let mergeTag:any = await tags.find({ tag: body.mergeTag, is_active: true, deleted:false });
    if(mergeTag.length){
      mergeTagId = mergeTag[0]._id;
    }else{
      let mergeTag:any = await tags.create({tag:body.mergeTag,is_active:true});
      mergeTagId =  mergeTag._id;

    }
    let tagData = (await tags.find({_id:{$in:body.tags}})).map(({tag}: any)=>tag)
    let docData = await documents.find({ tags: { "$in": body.tags } })
    let docIds = docData.map((doc) => { return doc._id })
    let updateDocs = await documents.update({ _id: { "$in": docIds } }, {
      $pull: { tags: { $in: body.tags } }
    }, { multi: true });
    let updateDocsWithMergeTag = await documents.update({ _id: { "$in": docIds } }, {
      $addToSet: { tags: mergeTagId }
    }, { multi: true });
    let bodyObj = {
      tags:body.tags,
      mergeTag:mergeTagId
    }
    let messageMergeTags = await mergeMessageTags(bodyObj, token)
    let taskMergeTags = await mergeTaskTags(bodyObj,token);
    let removeTagIds = body.tags.filter((tag: any) => tag != mergeTagId)
    let removeTags = await tags.remove({ _id: { "$in": removeTagIds } });
    //   $set: { deleted: true }
    // },
    //   { multi: true });
    await create({ activityType: "MERGED-TAG", activityBy: userId,mergedTag:body.mergeTag,tagsToMerge:tagData})
    return {
      status: true, 
      Message: "Tags Merged Successfully",
      mergeTagId
    }
  } catch (err) {
    console.error(err);
    throw err;
  }
}
async function mergeMessageTags(body: any, token: string) {
  try {
    let Options = {
      uri: `${MESSAGE_URL}/v1/merge/tags`,
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: body,
      json: true
    }
    return await request(Options);
  } catch (err) {
    throw err
  };
};

async function mergeTaskTags(body: any, token: string) {
  try {
    let Options = {
      uri: `${TASK_URL}/tag/merge`,
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: body,
      json: true
    }
    return await request(Options);
  } catch (err) {
    throw err
  };
};