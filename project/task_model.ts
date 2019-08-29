import { Schema, model, Types } from "mongoose";
import { project } from "./project_model";

const schema = new Schema({
    name: { type: String, trim: true },
    startDate: { type: Date, default: new Date() },
    endDate: { type: Date },
    access: { type: Array },
    file: { type: String },
    fileName: { type: String },
    projectId: {type: Types.ObjectId, ref: project},
    is_active: { type: Boolean, default: true }
}, { timestamps: true });

export const taskModel: any = model("task", schema);