import { Schema, model } from "mongoose";

const schema = new Schema({
    role: { type: String, unique: true, trim: true },
});

export const roles: any = model("roles", schema);