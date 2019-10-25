import { Schema, model } from "mongoose";

const schema = new Schema(
  {
    name: { type: String, trim: true },
    doc_id: [{ type: Schema.Types.ObjectId, ref: 'documents' }], 
    parentId: { type: String },
    ownerId: { type: String },
  },
  { timestamps: true }
);

export const folders = model("folders", schema);