import { privateGroupSchema } from "./model";
import * as mongoose from "mongoose";
import { RESPONSE } from "../utils/error_msg";

export interface privateGroup extends mongoose.Document {
    name: string;
    description: number;
    members: string[];
    createdBy: string;
    is_active: boolean
};
//  create Private Group 
export async function createPrivateGroup(body:privateGroup, userId: string ): Promise<object>{
    try {
        if(!body.name || !Array.isArray(body.members)) throw new Error("Missing Required Fields.");
        return privateGroupSchema.create({...body, createdBy: userId})  
    } catch (err) {
      throw err  
    };
};

//  edit Private Group
export async function editPrivateGroup(groupId:string, body: privateGroup, userId: string): Promise<any>{
    try {
        let groupDetails: any = await privateGroupSchema.findById(groupId).exec();
        if(!groupDetails) throw new Error("Group Not Found.");
        if(groupDetails.createdBy != userId ) throw new Error("Unautherized Action.");
        if(Array.isArray(body.members) && body.members.length){
            let removedUsers = groupDetails.members.filter((userId: string)=> !body.members.includes(userId))
            let newUsers = body.members.filter((userId: string) => !groupDetails.members.includes(userId) )
            body.members = removedUsers.concat(newUsers)
        }
        return await privateGroupSchema.findByIdAndUpdate(groupId, body) 
    } catch (err) {
        throw err
    };
};

//  change private Group status
export async function privateGroupStatus(groupId: string, userId: string): Promise<any> {
    try {
        let group: any = await privateGroupSchema.findById(groupId).exec();
        if (!group) throw new Error("Group Not Found.");
        if (group.createdBy._id != userId) throw new Error("Unautherized Action.")
        let data: any = await privateGroupSchema.findByIdAndUpdate(groupId, { is_active: group.is_active ? false : true });
        return { message: data.is_active ? RESPONSE.ACTIVE : RESPONSE.INACTIVE };
    } catch (err) {
        throw err;
    };
};

//  Get Group Detail
export async function privateGroupDetails(groupId: string): Promise<any>{
    try {
        return await privateGroupSchema.findById(groupId).exec()
    } catch (err) {
      throw err; 
    };
};

//  Get Group Detail
export async function privateGroupList(): Promise<any[]>{
    try {
        return await privateGroupSchema.find({}).exec()
    } catch (err) {
      throw err; 
    };
};