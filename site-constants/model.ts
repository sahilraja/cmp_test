import {Schema,model} from "mongoose";
import * as mongoosePaginate from "mongoose-paginate";

const schema = new Schema({
    key:{type: String},
    value:{type: String},
    groupName:{type: String},
    displayName:{type: String}
    },{timestamps: true });
schema.plugin(mongoosePaginate);
export const constantSchema = model("constant", schema);