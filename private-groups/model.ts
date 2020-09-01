import { Schema, model } from "mongoose";
import * as mongoosePagination from "mongoose-paginate";


const schema = new Schema({
    name: { type: String, trim: true, required: true},
    codeName: { type: String, trim: true, required: true, unique: true, lowercase: true},
    description: { type: String, trim: true },
    members: { type: Array },
    createdBy: { type: String, required: true },
    is_active: { type: Boolean, default: true }
}, { timestamps: true });
schema.index({codeName:1, createdBy:1, is_active:1})
schema.index({name:1, createdBy:1, is_active:1})

schema.plugin(mongoosePagination);
export const privateGroupSchema = model("private_group", schema);