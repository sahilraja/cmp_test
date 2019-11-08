import { tags } from "./tag_model";
import { documents } from "../documents/model"
const MESSAGE_URL = process.env.MESSAGE_URL || "http://localhost:4001";
const TASK_URL = process.env.TASK_HOST || "http://localhost:5052";
 
import * as request from "request-promise";


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
export async function mergeTags(body: any, token: string) {
  try {
    if(!body.tags ||!body.mergeTag) throw new Error("All Mandatory Fields Required")
    let docData = await documents.find({ tags: { "$in": body.tags } })
    let docIds = docData.map((doc) => { return doc._id })
    let updateDocs = await documents.update({ _id: { "$in": docIds } }, {
      $pull: { tags: { $in: body.tags } }
    }, { multi: true });
    let updateDocsWithMergeTag = await documents.update({ _id: { "$in": docIds } }, {
      $addToSet: { tags: body.mergeTag }
    }, { multi: true });
    let messageMergeTags = await mergeMessageTags(body, token)
    let taskMergeTags = await mergeTaskTags(body,token);
    let removeTagIds = body.tags.filter((tag: any) => tag != body.mergeTag)
    let removeTags = await tags.update({ _id: { "$in": removeTagIds } }, {
      $set: { deleted: true }
    },
      { multi: true });
    return {
      status: true, 
      Message: "Tags Merged Successfully"
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