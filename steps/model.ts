import { Schema, model } from "mongoose";
const plugin = require("mongoose-transform").default;
const SchemaDef = new Schema({
    name: { type: String, trim: true, required: 'Name is required' },
    createdBy:{ type: String },
    disabled: { type: Boolean, default: false }
}, { timestamps: true })

SchemaDef.plugin(plugin)
export const StepsSchema = model('steps', SchemaDef)