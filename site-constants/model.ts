import { Schema, model } from "mongoose";
import * as mongoosePaginate from "mongoose-paginate";

const schema = new Schema({
    key: { type: String },
    value: { type: String },
    groupName: { type: String },
    type: { type: String, default: "string" },
    displayName: { type: String }
}, { timestamps: true });
schema.plugin(mongoosePaginate);
schema.index({key:1})
export const constantSchema = model("constant", schema);