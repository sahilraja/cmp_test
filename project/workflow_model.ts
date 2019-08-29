import { Schema, model, Types } from "mongoose";
import { Users } from "../users/model";
import { taskModel } from "./task_model";

const schema = new Schema({
    type: { type: String, trim: true },
    role: { type: String, trim: true },
    user: { type: Types.ObjectId, ref: Users },
    status: { type: String, enum: ["PENDING", "REJECT", "APPROVE"] },
    taskId: { type: Types.ObjectId, ref: taskModel },
    is_active: { type: Boolean, default: true }
}, { timestamps: true });

export const workflowModel: any = model("workflow", schema);