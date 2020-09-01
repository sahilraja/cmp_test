import { Schema, model } from "mongoose";

const schema = new Schema(
  {
    type: { type: String, trim: true },
    comment: { type: String, trim: true },
    entity_id: { type: String },
    user_id: { type: String }
  },
  { timestamps: true }
);
schema.index({entity_id:1})
schema.index({user_id:1})
schema.index({user_id:1, entity_id:1})

export const comments = model("comments", schema);
