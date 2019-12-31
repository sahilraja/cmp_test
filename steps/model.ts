import { Schema, model } from "mongoose";
import plugin from "mongoose-transform";
const SchemaDef = new Schema({
    s_no: { type: Number },
    name: { type: String, trim: true, required: 'Name is required' },
    nameCode: { type: String, trim: true, lowercase: true, unique: true },
    createdBy: { type: String },
    disabled: { type: Boolean, default: false }
}, { timestamps: true })

SchemaDef.plugin(plugin)
export const StepsSchema = model('steps', SchemaDef)