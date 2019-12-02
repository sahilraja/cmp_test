import * as request from "request-promise";
import { RBAC_URL } from "../utils/urls";
import * as fs from "fs";
import { join } from "path";
import { userFindOne,userList } from "../utils/users";
import { userRoleAndScope } from "../role/module";
import { checkRoleScope } from '../utils/role_management'
import { COMMENT_ROUTER } from "../utils/error_msg";
import { comments } from "./model";
import { sendNotification, getFullNameAndMobile } from "../users/module";

export async function addComment(body: any, user: any) {
    try {
      if(!body.type || !body.comment || !body.entity_id) throw new Error("All mandatory fields are required")
      let commentInfo =  await comments.create({
        type: body.type,
        comment: body.comment,
        entity_id: body.entity_id,
        user_id: user._id
      });
      if(body.type == "document"){
        const {fullName,mobileNo} = getFullNameAndMobile(user);
        sendNotification({ id: user._id, fullName, mobileNo, email: user.email, templateName: "addCommentToDoc", mobileTemplateName:"addCommentToDoc"});
      }
      return commentInfo
    } catch (error) {
      console.error(error);
      throw error;
    }
}


 export async function commentsList(doc_id: String,type: string) {
    try {
      if(!doc_id) {throw new Error("Id is required")}
      let data = await comments.find({ entity_id: doc_id, type: type});        
      const commentsList = await Promise.all(
        data.map(comment=> {
          return commentData(comment);
        })
      );
      return { comments: commentsList };
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
  
  async function commentData(commentData: any) {
    try {
        let data= await Promise.all([{
            commentId: commentData._id,
            comment:commentData.comment,
            type: commentData.type,
            createdAt: commentData.createdAt,
            role:(((await userRoleAndScope(commentData.user_id)) as any).data || [""])[0],
            user:await userFindOne("id", commentData.user_id, { firstName: 1,middleName:1,lastName:1,email:1 }
        )}])
  return data[0]
     
    } catch (err) {
      throw err;
    }
  }
  