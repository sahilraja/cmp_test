import { Schema, model } from "mongoose";

const schema = new Schema(
    {
        docId: { type: Schema.Types.ObjectId, ref: 'documents' },
        requestedBy: { type: String },
        isDelete: { type: Boolean, default: false },
    },
    { timestamps: true }
);

export const docRequestModel = model("document-request", schema);