import { Schema, model } from "mongoose";
import * as mongoosePagination from "mongoose-paginate";

const schema = new Schema({
    name: { type: String, trim: true, required: true },
    description: { type: String, trim: true },
    members: { type: Array },
    createdBy: { type: String, required: true },
    is_active: { type: Date, default: new Date() }
}, { timestamps: true });

schema.plugin(mongoosePagination);
export const privateGroupSchema = model("private group", schema);