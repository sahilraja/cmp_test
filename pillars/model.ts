import { Schema, model } from "mongoose";
import plugin from "mongoose-transform";
const SchemaDef = new Schema({
    name: { type: String },
    createdBy: { type: String },
}, { timestamps: true })

SchemaDef.plugin(plugin)
export const PillarSchema = model('pillars', SchemaDef)