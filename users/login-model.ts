import {Schema,model} from "mongoose";
import * as mongoosePaginate from "mongoose-paginate";

const schema = new Schema({
    userId: {type: String},
    ip: { type: String }
    },{ timestamps: true }
);
schema.plugin(mongoosePaginate);
export const loginSchema = model("login_time", schema);