import { Schema, model } from "mongoose";

const schema = new Schema({
    tag: { type: String, unique: true, trim: true },
    description: { type: String, trim: true },
    is_active: { type: Boolean, default: true }
}, { timestamps: true });

export const tags: any = model("tags", schema);