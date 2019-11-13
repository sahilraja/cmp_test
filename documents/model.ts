import { Schema, model, Types } from "mongoose";

const schema = new Schema(
  {
    name: { type: String, trim: true, lowercase: true },
    description: { type: String, trim: true },
    tags: { type: Array},
    themes: { type: Array },
    fileId: { type: String },
    versionNum: { type: String },
    status: { type: String, enum: [0, 1, 2, 3] },
    parentId: { type: String},
    ownerId: { type: String },
    fileName: { type: String },
    collaborator: { type: Array },
    viewer: { type: Array },
    is_active: { type: Boolean, default: true },
    sourceId: { type: String },
    isDeleted:{ type: Boolean, default: false },
    suggestedTags:[{ userId:String, tags:Array }],
    rejectedTags:[{ userId:String, tags:Array }]
  },
  { timestamps: true }
);

export const documents = model("documents", schema);
