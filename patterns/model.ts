import { Schema, model } from "mongoose";
import * as mongoosePagination from "mongoose-paginate";

const schema = new Schema({
    patternCode: { type: String, trim: true, required: true},
    patternName: { type: String, trim: true, required: true },
    createdBy: { type: String, required: true },
    isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

schema.plugin(mongoosePagination);
export const patternSchema = model("patterns", schema);