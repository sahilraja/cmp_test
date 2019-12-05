import { Schema, model } from "mongoose";

let SchemaDef = new Schema({
    userId: { type: String },
    isParent: { type: Boolean, default: false },
    text: { type: String },
    projectId: { type: Schema.Types.ObjectId, ref: 'project' }
}, { timestamps: true })

export const OpenCommentsModel = model('open_comments', SchemaDef)