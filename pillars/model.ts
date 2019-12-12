import { Schema, model } from "mongoose";
import plugin from "mongoose-transform";
const SchemaDef = new Schema({
    name: { type: String, trim: true, required: 'Name is required', lowercase: true, unique: true },
    createdBy: { type: String },
    disabled: { type: Boolean, default: false }
}, { timestamps: true })
console.log(plugin)
SchemaDef.plugin(plugin)
export const PillarSchema = model('pillars', SchemaDef)