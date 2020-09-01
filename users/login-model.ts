import { Schema, model } from "mongoose";
import * as mongoosePaginate from "mongoose-paginate";

const schema = new Schema({
    type: { type: String , enum: ["LOGIN", "LOGOUT"]},
    userId: { type: String },
    ip: { type: String }
}, { timestamps: true }
);
schema.index({userId:1})
schema.plugin(mongoosePaginate);
export const loginSchema = model("login_time", schema);