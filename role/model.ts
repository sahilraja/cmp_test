import {Schema,model} from "mongoose";
import * as mongoosePaginate from "mongoose-paginate";

const schema = new Schema({
    role: { type: String, unique: true },
    roleName: { type: String},
    category: { type: String },
    description:{type: String},
    createdBy:{type:String}
    },{ timestamps: true }
);
schema.plugin(mongoosePaginate);
export const roleSchema = model("roles", schema);