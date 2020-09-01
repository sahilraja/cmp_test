import { Schema, model } from "mongoose";

const schema = new Schema(
    {
        docId: { type: Schema.Types.ObjectId, ref: 'documents' },
        requestedBy: { type: String },
        isDelete: { type: Boolean, default: false },
    },
    { timestamps: true }
);

schema.index({docId:1, requestedBy:1, isDelete:1})
export const docRequestModel = model("document-request", schema);