import { Schema, model } from "mongoose";

enum Status {
    Draft = 0,
    Published,
    Unpublished,
    Deleted,
}
const schema = new Schema({
    name: { type: String, trim: true },
    description: { type: String, trim: true },
    tags: { type: Array },
    themes: { type: Array },
    fileId: { type: String },
    versionNum: { type: String },
    status: { type: String, enum: [0, 1, 2, 3] },
    parentId: { type: String },
    ownerId: { type: String },
    fileName:{type:String},
    is_active: { type: Boolean, default: true }
}, { timestamps: true });

export const documents = model("documents", schema);

