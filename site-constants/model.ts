import {Schema,model} from "mongoose";
import * as mongoosePaginate from "mongoose-paginate";

const schema = new Schema({
    aboutMe:{type:Number}
    },{strict: false,timestamps: true });
schema.plugin(mongoosePaginate);
export const constantSchema = model("constant", schema);