import { Schema, model } from "mongoose";
let SchemaDef = new Schema({
    docId: { type: String },
    taskId: { type: String },
    activityBy: { type: String },
    taskStatus: { type: String }
}, { timestamps: true })
SchemaDef.index({ taskId: 1 })
SchemaDef.index({ taskId: 1, docId: 1 })
export const DocumentTaskActivityModel = model(`doc_task_activities`, SchemaDef)