import { Schema, model } from "mongoose";

const schema = new Schema({
    name: { type: String, unique: true, trim: true },
    description: { type: String, trim: true },
    users: { type: Array },
    is_active: { type: Boolean, default: true }
}, { timestamps: true });

export const groupsModel = model("groups", schema);