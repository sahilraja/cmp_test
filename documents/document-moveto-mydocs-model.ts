import { Schema, model } from "mongoose";

const schema = new Schema(
    {
        docId: { type: Schema.Types.ObjectId, ref: 'documents' },
        userId: { type: String },
        isDeleted: { type: Boolean, default: false },
    },
    { timestamps: true }
);

schema.index({docId:1, userId:1, isDeleted:1})
export const moveToMyDocsModel = model("document-moveto-mydocs", schema);