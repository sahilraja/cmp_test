import { Schema, model } from "mongoose";

let SchemaDef = new Schema({
    userId: { type: String },
    isParent: { type: Boolean, default: false },
    text: { type: String },
    projectId: { type: Schema.Types.ObjectId, ref: 'project' }
}, { timestamps: true })
SchemaDef.index({userId:1})
SchemaDef.index({projectId:1})
SchemaDef.index({userId:1, projectId:1})

export const OpenCommentsModel = model('open_comments', SchemaDef)