import * as request from "request-promise";
import { RBAC_URL } from "../utils/urls";
import * as fs from "fs";
import { join } from "path";
import { userList } from "../utils/users";
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
      console.log(error);
      throw error;
    }
  }

 export async function commentsList(doc_id: String){

 }