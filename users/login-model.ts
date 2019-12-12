import { Schema, model } from "mongoose";
import * as mongoosePaginate from "mongoose-paginate";

const schema = new Schema({
    type: { type: String , enum: ["LOGIN", "LOGOUT"]},
    userId: { type: String },
    ip: { type: String }
}, { timestamps: true }
);
schema.plugin(mongoosePaginate);
export const loginSchema = model("login_time", schema);