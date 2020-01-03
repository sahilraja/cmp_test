import { Schema, model } from "mongoose";
import * as mongoosePagination from "mongoose-paginate";
const uniqueValidator = require('mongoose-unique-validator');

const schema = new Schema({
    name: { type: String, trim: true, required: true, unique: true, uniqueCaseInsensitive: true },
    description: { type: String, trim: true },
    members: { type: Array },
    createdBy: { type: String, required: true },
    is_active: { type: Boolean, default: true }
}, { timestamps: true });

schema.plugin(uniqueValidator, { message: 'Error, expected {PATH} to be unique.' });
schema.plugin(mongoosePagination);
export const privateGroupSchema = model("private_group", schema);