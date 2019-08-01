import { Schema, model } from "mongoose";

const userSchema = new Schema({
    firstName: String,
    lastName: String,
    role : String,
});

export const Users = model("users", userSchema);