import { Schema, model, Types } from "mongoose";

const schema = new Schema({
    percentage: { type: Number, trim: true, required: true },
    phase: { type: String, trim: true, lowercase: true, unique: true, required: true },
    projectId: { type: Types.ObjectId, ref: 'project' },
    createdBy: { type: String },
    isDeleted: { type: Boolean, default: false }
}, { timestamps: true })

export const financialSchema = model('financial_info', schema)