import { Schema, model } from "mongoose";
const SchemaDef = new Schema({
    oldUser: { type: String },
    replacedWith: { type: String },
    replacedBy: { type: String }
}, { timestamps: true })

export const ReplaceUserSchema = model('replace_user', SchemaDef)