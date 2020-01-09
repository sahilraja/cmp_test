import { Schema, model } from "mongoose";
const SchemaDef = new Schema({
    projectId: { type: Schema.Types.ObjectId, ref: 'project' },
    complianceType: { type: String },
    documentNeeded:{type: Boolean, default: false},
    complaint: {type: Boolean, default: false},
    taskId: { type: String },
    name: { type: String, trim: true },
    document: { type: String },
    createdBy: { type: String }
}, { timestamps: true })

SchemaDef.index({ projectId: 1 })
export const ComplianceSchema = model('compliances', SchemaDef)