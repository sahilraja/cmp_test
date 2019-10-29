import * as request from "request-promise";
import { RBAC_URL } from "../utils/urls";
import * as fs from "fs";
import { join } from "path";
import { userFindOne,userList } from "../utils/users";
import { userRoleAndScope } from "../role/module";
import { checkRoleScope } from '../utils/role_management'
import { COMMENT_ROUTER } from "../utils/error_msg";
import { comments } from "./model";

export async function addComment(body: any, userId: string) {
    try {
      return await comments.create({
        name: body.name,
        comment: body.comment,
        entity_id: body.entity_id,
        user_id: userId
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  }


 export async function commentsList(doc_id: String) {
    try {
      let data = await comments
        .find({ entity_id: doc_id})
        .sort({ updatedAt: -1 }).exec();        
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
            role:(((await userRoleAndScope(commentData.user_id)) as any).data.global || [
                ""
              ])[0], 
             user:await userFindOne("id", commentData.user_id, { firstName: 1,middleName:1,lastName:1,email:1 }
        )}])
  return data[0]
     
    } catch (err) {
      throw err;
    }
  }
  