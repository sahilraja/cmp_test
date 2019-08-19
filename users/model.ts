import { Schema, model } from "mongoose";

const userSchema = new Schema({
    username: {type: String, trim: true},
    role: { type: Schema.Types.ObjectId, ref: 'role' },
    email: { type: String, trim: true, match: /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/ },
    firstName: String,
    lastName: String,
});

export const Users: any = model("users", userSchema);