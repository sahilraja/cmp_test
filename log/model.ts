import { Schema, model } from "mongoose";

const SchemaDef = new Schema({
    activityType: { type: String, trim: true },
    activityBy: { type: String },
    taskId: { type: String },
    projectId: {type: String}
}, { timestamps: true })

SchemaDef.index({activityType:1})
export const ActivitySchema = model('activity_log', SchemaDef)