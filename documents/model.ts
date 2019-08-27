import { Schema, model } from "mongoose";

const schema = new Schema({
    name: { type: String, trim: true },
    description: { type: String, trim: true },
    tags: { type: Array },
    themes: { type: Array },
    fileId: { type: String },
    versionId: { type: String },
    status: { type: String },
    parentId: { type: String },
    ownerId: { type: String },
    is_active: { type: Boolean, default: true }
}, { timestamps: true });

export const documents: any = model("documents", schema);