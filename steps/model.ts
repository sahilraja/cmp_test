import { Schema, model } from "mongoose";
import plugin from "mongoose-transform";
const SchemaDef = new Schema({
    name: { type: String, trim: true, required: 'Name is required' },
    createdBy:{ type: String },
    disabled: { type: Boolean, default: false }
}, { timestamps: true })

SchemaDef.plugin(plugin)
export const StepsSchema = model('steps', SchemaDef)